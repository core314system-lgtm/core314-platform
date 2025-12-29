exports.handler = async (event) => {
  console.log("[SLACK] Event received", { body: event.body });

  try {
    const parsedPayload = JSON.parse(event.body || "{}");
    console.log("[SLACK] Parsed payload", parsedPayload);

    // Slack URL verification challenge
    if (parsedPayload.type === "url_verification" && parsedPayload.challenge) {
      console.log("[SLACK] Event decision", {
        type: parsedPayload?.event?.type,
        subtype: parsedPayload?.event?.subtype,
        ignored: false,
        reason: "url_verification challenge - echoing challenge"
      });
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ challenge: parsedPayload.challenge })
      };
    }

    // Acknowledge Slack events
    if (parsedPayload.type === "event_callback") {
      console.log("[SLACK] Event decision", {
        type: parsedPayload?.event?.type,
        subtype: parsedPayload?.event?.subtype,
        ignored: false,
        reason: "event_callback - acknowledging"
      });
      return {
        statusCode: 200,
        body: "ok"
      };
    }

    console.log("[SLACK] Event decision", {
      type: parsedPayload?.event?.type,
      subtype: parsedPayload?.event?.subtype,
      ignored: true,
      reason: "unknown event type - ignoring"
    });
    return {
      statusCode: 200,
      body: "ignored"
    };
  } catch (err) {
    console.error("[SLACK] Parse error", err);
    return {
      statusCode: 500,
      body: "error"
    };
  }
};
