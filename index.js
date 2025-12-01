import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import dotenv from "dotenv";
import pkg from "transbank-sdk";

dotenv.config();

const { WebpayPlus } = pkg;

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ruta de prueba
app.get("/ping", (req, res) => {
  res.json({ ok: true });
});

// Configurar vistas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Archivo historial
const historialPath = path.join(__dirname, "historial.json");

// ===============================
// CREAR TRANSACCIÓN
// ===============================
app.post("/webpay/create", async (req, res) => {
  try {
    const { buyOrder, sessionId, amount } = req.body;

    if (!buyOrder || !sessionId || !amount) {
      return res.status(400).json({ error: "Faltan datos en la solicitud" });
    }

    console.log("🔹 buyOrder:", buyOrder);
    console.log("🔹 sessionId:", sessionId);
    console.log("🔹 amount:", amount);
    console.log("🔹 returnUrl:", process.env.TBK_RETURN_URL);

    // 🔹 Crear instancia de WebpayPlus
    const transaction = new WebpayPlus.Transaction({
      commerceCode: process.env.TBK_COMMERCE_CODE,
      apiKey: process.env.TBK_API_KEY,
      environment: "integration" // correcto para v6.x
    });

    // 🔹 Crear transacción
    const response = await transaction.create(
      buyOrder,
      sessionId,
      amount,
      process.env.TBK_RETURN_URL // string directo
    );

    console.log("✅ Transacción creada:", response);

    return res.json({
      url: response.url,
      token: response.token
    });

  } catch (error) {
    console.error("❌ Error al crear transacción:", error);
    return res.status(500).json({
      error: "Error al crear transacción",
      detalles: error.message || error
    });
  }
});

// ===============================
// COMMIT DE TRANSACCIÓN
// ===============================
app.post("/webpay/commit", async (req, res) => {
  try {
    const { token_ws: token, correo, productos = [] } = req.body;

    if (!token || !correo) {
      return res.status(400).json({ error: "Faltan datos para commit" });
    }

    const transaction = new WebpayPlus.Transaction({
      commerceCode: process.env.TBK_COMMERCE_CODE,
      apiKey: process.env.TBK_API_KEY,
      environment: "integration"
    });

    const response = await transaction.commit(token);

    const registro = {
      id_transaccion: response.buy_order,
      fecha: new Date().toISOString(),
      monto: response.amount,
      productos,
      estado: response.status,
      metodo: "Webpay Plus"
    };

    let historial = {};
    if (await fs.pathExists(historialPath)) {
      historial = await fs.readJSON(historialPath);
    }
    if (!historial[correo]) historial[correo] = [];
    historial[correo].push(registro);

    await fs.writeJSON(historialPath, historial, { spaces: 2 });

    return res.json(registro);

  } catch (error) {
    console.error("❌ Error en commit:", error);
    return res.status(500).json({ error: "Error en commit", detalles: error.message || error });
  }
});

// ===============================
// RETURN DESDE WEBPAY (redirección navegador)
app.get("/webpay/return", (req, res) => {
  const token = req.query.token_ws;
  if (!token) return res.send("No se recibió token de Webpay.");
  res.render("commit", { token });
});

// ===============================
// HISTORIAL DE COMPRAS
app.get("/historial/:correo", async (req, res) => {
  const correo = req.params.correo;

  try {
    if (!(await fs.pathExists(historialPath))) return res.json([]);
    const historial = await fs.readJSON(historialPath);
    return res.json(historial[correo] || []);
  } catch (error) {
    console.error("❌ Error leyendo historial:", error);
    return res.status(500).json({ error: "Error leyendo historial", detalles: error.message || error });
  }
});

// ===============================
// SERVIDOR
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("✅ Backend Webpay funcionando en Render en puerto", PORT);
});
