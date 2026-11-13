import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

const { MONGODB_URI, ALLOWED_ORIGIN, PORT = 3000 } = process.env;
if (!MONGODB_URI) throw new Error('Falta MONGODB_URI en las variables de entorno');

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN ? ALLOWED_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '1mb' }));

// Un documento por consultorio: "code" es el código secreto y "data" es todo el estado de la página
const consultorioSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false }
);
const Consultorio = mongoose.model('Consultorio', consultorioSchema);

const validCode = (req, res, next) =>
  /^[A-Za-z0-9-]{12,64}$/.test(req.params.code)
    ? next()
    : res.status(400).json({ error: 'Código inválido (12 a 64 letras, números o guiones)' });

app.get('/', (_req, res) => res.send('API dental funcionando'));

// Leer los datos
app.get('/api/state/:code', validCode, async (req, res) => {
  const doc = await Consultorio.findOne({ code: req.params.code }).lean();
  if (!doc) return res.sendStatus(404);
  res.json(doc.data);
});

// Guardar (crea o actualiza)
app.put('/api/state/:code', validCode, async (req, res) => {
  const b = req.body;
  if (!b || !Array.isArray(b.fix) || !Array.isArray(b.mat) || !Array.isArray(b.services)) {
    return res.status(400).json({ error: 'Datos con formato inválido' });
  }
  await Consultorio.findOneAndUpdate(
    { code: req.params.code },
    { $set: { data: b } },
    { upsert: true }
  );
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

await mongoose.connect(MONGODB_URI);
app.listen(PORT, () => console.log(`API lista en el puerto ${PORT}`));
