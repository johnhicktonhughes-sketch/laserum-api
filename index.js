require("dotenv").config();
const express = require("express");
const db = require("./db");

const API_KEY = process.env.API_KEY;

function verifyApiKey(req, res, next) {
  const key = req.headers["x-api-key"];

  if (!key) {
    return res.status(401).json({ error: "Missing API key" });
  }

  if (key !== API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
}


const app = express();
app.use(express.json());
app.use(verifyApiKey);

/**
 * GET /prices?area=legs&bundle=single&sex=F
 */
app.get("/prices", async (req, res) => {
  const { area, bundle, sex } = req.query;

  if (!area || !bundle || !sex) {
    return res.status(400).json({
      error: "Please supply all of 'area' and 'bundle' and 'sex' query parameters"
    });
  }

  try {
    const query = `
      SELECT *
      FROM trengo.laserum
      WHERE name % $1
        AND product_bundle = $2
        AND customer_type = $3
    ORDER BY similarity(name, $1) DESC
      LIMIT 1;
    `;

    const { rows } = await db.query(query, [area, bundle, sex]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "No close match found for this area/bundle/" });
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`API running on port ${process.env.PORT}`);
});

/**
 * GET /prices/by-size?size=medium
 */
app.get("/prices/by-size", async (req, res) => {
  const { size } = req.query;

  if (!size) {
    return res.status(400).json({ error: "Size parameter is required" });
  }

  const query = `
    SELECT *
    FROM trengo.laserum
    WHERE LOWER(size) = LOWER($1)
    ORDER BY name, product_bundle
  `;

  try {
    const { rows } = await db.query(query, [size]);

    if (!rows.length) {
      return res.status(404).json({ message: "No prices found for this size" });
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

/**
 * GET /prices/bundles
 * Returns all bundled products
 */
app.get("/prices/bundles", async (req, res) => {
  const query = `
    SELECT *
    FROM trengo.laserum
    WHERE product_bundle = TRUE
    ORDER BY price DESC
    LIMIT 1;
  `;

  try {
    const { rows } = await db.query(query);
    
    if (!rows.length) {
      return res.status(404).json({ message: "No bundles found" });
    }

    res.json({data:rows});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

/**
 * GET /bundles/:id
 * Example: /bundles/80
 */
app.get("/bundles/:id", async (req, res) => {
  const { id } = req.params;

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid product id" });
  }

  const query = `
    SELECT lp.*, l.name
    FROM trengo.laserum_pack lp
    INNER JOIN trengo.laserum l ON l.id = lp.treatment_id
    WHERE lp.product_id = $1
    ORDER BY l.name
  `;

  try {
    const { rows } = await db.query(query, [id]);

    if (!rows.length) {
      return res.status(404).json({
        message: "No products found for this bundle"
      });
    }

    res.json({
      product_id: Number(id),
      total_items: rows.length,
      items: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query failed" });
  }
});

