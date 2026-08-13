const DEFAULT_MONITOR_INTERVAL_MS = 15_000;
const DEFAULT_RECOVERY_DELAY_MS = 250;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15 * 60_000;

function errorDetails(error) {
  if (!error) return {};
  return {
    errorName: String(error.name || 'Error'),
    errorCode: String(error.code || ''),
    errorMessage: String(error.message || error).slice(0, 1_000),
    errorStack: String(error.stack || '').split('\n').slice(0, 12).join('\n'),
  };
}

function memoryDetails() {
  const memory = process.memoryUsage();
  return {
    rssMb: Math.round(memory.rss / 1024 / 1024),
    heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
    externalMb: Math.round(memory.external / 1024 / 1024),
  };
}

export function createResilientServerRuntime({
  server,
  host = '127.0.0.1',
  port = 3000,
  logger = console,
  monitorIntervalMs = DEFAULT_MONITOR_INTERVAL_MS,
  recoveryDelayMs = DEFAULT_RECOVERY_DELAY_MS,
  shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  manageProcess = true,
  exitProcess = (code) => process.exit(code),
} = {}) {
  if (!server || typeof server.listen !== 'function' || typeof server.close !== 'function') {
    throw new TypeError('Runtime wymaga instancji serwera HTTP.');
  }

  const startedAt = Date.now();
  const processHandlers = new Map();
  let starting = false;
  let shuttingDown = false;
  let recoveryTimer = null;
  let monitorTimer = null;
  let heartbeatTimer = null;
  let recoveryCount = 0;
  let fatalStarted = false;

  function log(level, event, details = {}) {
    const method = typeof logger?.[level] === 'function' ? logger[level].bind(logger) : logger?.log?.bind(logger);
    method?.(JSON.stringify({
      at: new Date().toISOString(),
      component: 'artway-backend-runtime',
      event,
      pid: process.pid,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1_000),
      ...details,
    }));
  }

  function clearRuntimeTimers() {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    if (monitorTimer) clearInterval(monitorTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    recoveryTimer = null;
    monitorTimer = null;
    heartbeatTimer = null;
  }

  function removeProcessHandlers() {
    for (const [event, handler] of processHandlers) process.removeListener(event, handler);
    processHandlers.clear();
  }

  function scheduleRecovery(reason) {
    if (shuttingDown || starting || server.listening || recoveryTimer) return;
    recoveryTimer = setTimeout(() => {
      recoveryTimer = null;
      recoveryCount += 1;
      log('warn', 'listen_recovery_attempt', { reason, recoveryCount });
      start(`recovery:${reason}`);
    }, Math.max(10, Number(recoveryDelayMs) || DEFAULT_RECOVERY_DELAY_MS));
  }

  function start(reason = 'startup') {
    if (shuttingDown || starting || server.listening) return false;
    starting = true;
    try {
      server.listen(port, host);
      log('info', 'listen_requested', { reason, host, port });
      return true;
    } catch (error) {
      starting = false;
      log('error', 'listen_throw', { reason, host, port, ...errorDetails(error) });
      scheduleRecovery('listen_throw');
      return false;
    }
  }

  async function stop({ reason = 'runtime_stop', exitCode = 0, terminateProcess = false } = {}) {
    if (shuttingDown) return;
    shuttingDown = true;
    clearRuntimeTimers();
    removeProcessHandlers();
    log('info', 'shutdown_started', { reason, exitCode, listening: server.listening });

    await new Promise((resolve) => {
      let completed = false;
      const finish = (forced = false, error = null) => {
        if (completed) return;
        completed = true;
        clearTimeout(forceTimer);
        log(error ? 'error' : 'info', 'shutdown_finished', { reason, exitCode, forced, ...errorDetails(error) });
        resolve();
      };
      const forceTimer = setTimeout(() => {
        server.closeAllConnections?.();
        finish(true);
      }, Math.max(100, Number(shutdownTimeoutMs) || DEFAULT_SHUTDOWN_TIMEOUT_MS));
      forceTimer.unref?.();

      if (!server.listening) {
        finish(false);
        return;
      }
      server.close((error) => finish(false, error));
    });

    if (terminateProcess) exitProcess(exitCode);
  }

  function fatal(reason, error) {
    if (fatalStarted || shuttingDown) return;
    fatalStarted = true;
    log('error', 'fatal_runtime_error', { reason, ...errorDetails(error), ...memoryDetails() });
    void stop({ reason, exitCode: 1, terminateProcess: true });
  }

  server.on('listening', () => {
    starting = false;
    const address = server.address();
    log('info', 'listening', {
      host: typeof address === 'object' && address ? address.address : host,
      port: typeof address === 'object' && address ? address.port : port,
      recoveryCount,
    });
  });

  server.on('close', () => {
    starting = false;
    if (shuttingDown) {
      log('info', 'server_closed_for_shutdown');
      return;
    }
    log('warn', 'server_closed_unexpectedly', { recoveryCount });
    scheduleRecovery('unexpected_close');
  });

  server.on('error', (error) => {
    starting = false;
    log('error', 'server_error', { listening: server.listening, ...errorDetails(error) });
    if (!server.listening) scheduleRecovery('server_error');
  });

  monitorTimer = setInterval(() => {
    if (!shuttingDown && !starting && !server.listening) {
      log('warn', 'monitor_detected_missing_listener', { recoveryCount });
      scheduleRecovery('monitor');
    }
  }, Math.max(1_000, Number(monitorIntervalMs) || DEFAULT_MONITOR_INTERVAL_MS));

  heartbeatTimer = setInterval(() => {
    log('info', 'heartbeat', { listening: server.listening, recoveryCount, ...memoryDetails() });
  }, Math.max(10_000, Number(heartbeatIntervalMs) || DEFAULT_HEARTBEAT_INTERVAL_MS));

  if (manageProcess) {
    const register = (event, handler) => {
      processHandlers.set(event, handler);
      process.on(event, handler);
    };
    register('SIGTERM', () => void stop({ reason: 'SIGTERM', exitCode: 0, terminateProcess: true }));
    register('SIGINT', () => void stop({ reason: 'SIGINT', exitCode: 0, terminateProcess: true }));
    register('uncaughtException', (error) => fatal('uncaughtException', error));
    register('unhandledRejection', (error) => fatal('unhandledRejection', error));
    register('warning', (warning) => log('warn', 'process_warning', errorDetails(warning)));
    register('beforeExit', (code) => {
      log('error', 'process_before_exit', { code, listening: server.listening, starting, shuttingDown });
      if (!shuttingDown) scheduleRecovery('before_exit');
    });
    register('exit', (code) => log(code ? 'error' : 'info', 'process_exit', { code, listening: server.listening, shuttingDown }));
  }

  return Object.freeze({
    start,
    stop,
    state: () => ({ starting, shuttingDown, listening: server.listening, recoveryCount, startedAt }),
  });
}
