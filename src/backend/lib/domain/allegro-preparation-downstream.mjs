export async function runAllegroPreparationDownstream({ afterPrepare, task, result, clean }) {
  try {
    return await afterPrepare(task, result);
  } catch (error) {
    return {
      channel: 'vonHalsky',
      status: 'retry',
      ready: false,
      error: clean(error?.message || error, 1000),
    };
  }
}
