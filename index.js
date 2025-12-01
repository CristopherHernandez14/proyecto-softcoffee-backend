import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configurar vistas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const historialPath = path.join(__dirname, "historial.json");

// ===============================
// CREAR TRANSACCIÓN (Webpay REST)
// ===============================
app.post("/webpay/create", async (req, res) => {
  try {
    const { buyOrder, sessionId, amount } = req.body;
    if (!buyOrder || !sessionId || !amount) {
      return res.status(400).json({ error: "Faltan datos en la solicitud" });
    }

    // URL base integración Webpay REST
    const baseUrl = "https://webpay3gint.transbank.cl"; // Integración

    // Crear transacción
    const response = await axios.post(`${baseUrl}/rswebpaytransaction/api/webpay/v1.0/transactions`, {
      buy_order: buyOrder,
      session_id: sessionId,
      amount: amount,
      return_url: process.env.TBK_RETURN_URL
    }, {
      headers: {
        "Tbk-Api-Key-Id": process.env.TBK_COMMERCE_CODE,
        "Tbk-Api-Key-Secret": process.env.TBK_API_KEY,
        "Content-Type": "application/json"
      }
    });

    const data = response.data;

    return res.json({
      url: data.url,
      token: data.token
    });

  } catch (error) {
    console.error("❌ Error al crear transacción:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Error al crear transacción",
      detalles: error.response?.data || error.message
    });
  }
});

// ===============================
// RETURN DESDE WEBPAY (opcional)
// ===============================
app.get("/webpay/return", (req, res) => {
  const token = req.query.token_ws;
  if (!token) return res.send("No se recibió token de Webpay.");
  res.render("commit", { token });
});

// ===============================
// HISTORIAL DE COMPRAS
// ===============================
app.get("/historial/:correo", async (req, res) => {
  const correo = req.params.correo;
  try {
    if (!(await fs.pathExists(historialPath))) return res.json([]);
    const historial = await fs.readJSON(historialPath);
    return res.json(historial[correo] || []);
  } catch (error) {
    console.error("Error leyendo historial:", error);
    return res.status(500).json({ error: "Error leyendo historial" });
  }
});

// ===============================
// SERVIDOR
// ===============================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Backend Webpay REST funcionando en Render en puerto", PORT);
});
