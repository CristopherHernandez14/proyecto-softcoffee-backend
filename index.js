import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { WebpayPlus } from "transbank-sdk";

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


const webpay = new WebpayPlus.Transaction(
  "597055555532", 
  "clave-secreta", 
  "https://webpay3gint.transbank.cl" 
);


app.post("/webpay/create", async (req, res) => {
  try {
    const { buyOrder, sessionId, amount } = req.body;

    const response = await webpay.create(
      buyOrder,
      sessionId,
      amount,
      "http://192.168.0.20:3000/webpay/return" 
    );

    return res.json({
      url: response.url,
      token: response.token
    });

  } catch (error) {
    console.error("Error al crear transacción:", error);
    res.status(500).json({ error: "Error al crear transacción" });
  }
});

app.get("/webpay/return", (req, res) => {
  const token = req.query.token_ws;

  if (!token) {
    return res.send("No se recibió token de Webpay.");
  }

  res.render("commit", { token });
});


// CONFIRMAR TRANSACCIÓN

app.post("/webpay/commit", async (req, res) => {
  const token = req.body.token_ws;

  const correo = req.body.correo;
  const productos = req.body.productos || [];

  try {
    const response = await webpay.commit(token);

    const registro = {
      id_transaccion: response.buy_order,
      fecha: new Date().toISOString(),
      monto: response.amount,
      productos: productos,
      estado: response.status,
      metodo: "Webpay Plus"
    };

    let historial = {};

    if (await fs.pathExists(historialPath)) {
      historial = await fs.readJSON(historialPath);
    }

    if (!historial[correo]) {
      historial[correo] = [];
    }

    historial[correo].push(registro);

    await fs.writeJSON(historialPath, historial, { spaces: 2 });

    return res.json(registro);

  } catch (error) {
    console.error("Error en commit:", error);
    res.status(500).json({ error: "Error en commit" });
  }
});


// HISTORIAL DE USUARIO

app.get("/historial/:correo", async (req, res) => {
  const correo = req.params.correo;

  try {
    if (!(await fs.pathExists(historialPath))) {
      return res.json([]);
    }

    const historial = await fs.readJSON(historialPath);

    return res.json(historial[correo] || []);

  } catch (error) {
    console.error("Error leyendo historial:", error);
    res.status(500).json({ error: "Error leyendo historial" });
  }
});


app.listen(3000, () => {
  console.log("Backend Webpay funcionando en http://localhost:3000");
});
