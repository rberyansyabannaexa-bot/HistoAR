export default async function handler(req, res) {
  try {
    console.log("=== TEST API ===");

    console.log(
      "API KEY:",
      process.env.ATOMESUS_API_KEY
        ? process.env.ATOMESUS_API_KEY.substring(0, 12) + "..."
        : "TIDAK ADA"
    );

    const response = await fetch("https://api.atomesus.com/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.ATOMESUS_API_KEY}`,
      },
    });

    const text = await response.text();

    console.log("STATUS:", response.status);
    console.log(text);

    res.status(response.status).send(text);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
      stack: err.stack,
    });
  }
}
