exports.handler = async (event) => {
  console.log("slack-events invoked");
  console.log("method:", event.httpMethod);
  console.log("raw body:", event.body);
  console.log("headers:", JSON.stringify(event.headers));

  try {
    const body = JSON.parse(event.body || "{}");

    // Slack URL verification challenge
    if (body.type === "url_verification" && body.challenge) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ challenge: body.challenge })
      };
    }

    // Acknowledge Slack events
    if (body.type === "event_callback") {
      return {
        statusCode: 200,
        body: "ok"
      };
    }

    return {
      statusCode: 200,
      body: "ignored"
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: "error"
    };
  }
};
