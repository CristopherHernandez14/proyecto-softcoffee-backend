import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import dotenv from "dotenv";
import mercadopago from "mercadopago";

dotenv.config();

// Configurar Mercado Pago
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

// Historial de compras
const historialPath = path.join(__dirname, "historial.json");

// ===============================
// CREAR PREFERENCIA DE PAGO
// ===============================
app.post("/pago/create", async (req, res) => {
  try {
    const { correo, carrito, total } = req.body;
    if (!correo || !carrito || !total) {
      return res.status(400).json({ error: "Faltan datos en la solicitud" });
    }

    const items = carrito.map((p, i) => ({
      id: i + "",
      title: p.nombre,
      quantity: 1,
      currency_id: "CLP",
      unit_price: Number(p.precio)
    }));

    const preference = {
      items,
      payer: { email: correo },
      back_urls: {
        success: process.env.MP_RETURN_URL,
        failure: process.env.MP_RETURN_URL,
        pending: process.env.MP_RETURN_URL
      },
      auto_return: "approved"
    };

    const response = await mercadopago.preferences.create(preference);

    return res.json({ url: response.body.init_point });

  } catch (error) {
    console.error("❌ Error al crear preferencia:", error);
    return res.status(500).json({ error: "Error al crear preferencia", detalles: error.message });
  }
});

// ===============================
// RETURN DESDE MERCADO PAGO
// ===============================
app.get("/pago/return", (req, res) => {
  res.send("Pago completado. Puedes cerrar esta ventana.");
});

// ===============================
// HISTORIAL DE COMPRAS
// ===============================
app.post("/historial/save", async (req, res) => {
  const { correo, carrito, total } = req.body;
  try {
    let historial = {};
    if (await fs.pathExists(historialPath)) {
      historial = await fs.readJSON(historialPath);
    }
    if (!historial[correo]) historial[correo] = [];

    historial[correo].push({
      fecha: new Date().toISOString(),
      productos: carrito.map(p => `${p.nombre} ($${p.precio})`),
      monto: total,
      metodo: "Mercado Pago"
    });

    await fs.writeJSON(historialPath, historial, { spaces: 2 });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Error guardando historial:", error);
    return res.status(500).json({ error: "Error guardando historial" });
  }
});

// ===============================
// SERVIDOR
// ===============================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Backend Mercado Pago funcionando en Render en puerto", PORT);
});
