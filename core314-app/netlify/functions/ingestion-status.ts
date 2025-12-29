export const handler = async () => {
  console.log("ingestion-status invoked");

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      slack_event_count: 0,
      teams_event_count: 0,
      last_slack_event_at: null,
      last_teams_event_at: null
    })
  };
};
