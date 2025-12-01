import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import dotenv from "dotenv";
import mercadopagoPkg from "mercadopago";

dotenv.config();

// Adaptar import de Mercado Pago
const mercadopago = mercadopagoPkg.default || mercadopagoPkg;

// Configurar token de sandbox
mercadopago.configurations.setAccessToken(process.env.MP_ACCESS_TOKEN);

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

// Archivo historial
const historialPath = path.join(__dirname, "historial.json");

// ===============================
// CREAR PAGO CON MERCADO PAGO
// ===============================
app.post("/payment/create", async (req, res) => {
  try {
    const { correo, productos, total } = req.body;
    if (!correo || !total) {
      return res.status(400).json({ error: "Faltan datos en la solicitud" });
    }

    // Crear preferencia
    const preference = {
      items: productos.map(p => ({
        title: p.nombre,
        quantity: 1,
        unit_price: p.precio,
      })),
      payer: {
        email: correo,
      },
      back_urls: {
        success: `${process.env.BACKEND_URL}/payment/success`,
        failure: `${process.env.BACKEND_URL}/payment/failure`,
        pending: `${process.env.BACKEND_URL}/payment/pending`,
      },
      auto_return: "approved",
    };

    const response = await mercadopago.preferences.create(preference);

    return res.json({
      init_point: response.response.init_point,
      preference_id: response.response.id
    });

  } catch (error) {
    console.error("❌ Error creando pago:", error);
    return res.status(500).json({
      error: "Error creando pago",
      detalles: error.message || error
    });
  }
});

// ===============================
// ENDPOINTS DE REDIRECCIÓN
// ===============================
app.get("/payment/success", (req, res) => {
  res.send("Pago aprobado ✅");
});

app.get("/payment/failure", (req, res) => {
  res.send("Pago fallido ❌");
});

app.get("/payment/pending", (req, res) => {
  res.send("Pago pendiente ⏳");
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
  console.log(`Backend Mercado Pago funcionando en Render en puerto ${PORT}`);
});
