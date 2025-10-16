import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: ["https://eliaskalyvas.gr", "https://www.eliaskalyvas.gr"],
  methods: ["POST", "OPTIONS"]
}));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID || "asst_UP9tj69HiHOLfgMnG9zZYTsV";

app.get("/", (_, res) => res.send("OK: GPT backend up"));

// --- Chat endpoint (Assistants Threads/Runs + File Search) ---
app.post("/chat", async (req, res) => {
  try {
    const user = (req.body?.message || "").slice(0, 2000);

    // 1) νέο thread (αν θες ιστορικό, αποθήκευσε/ξαναχρησιμοποίησε το id)
    const thread = await openai.beta.threads.create();

    // 2) μήνυμα χρήστη
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: user
    });

    // 3) τρέξε τον Assistant (εδώ ενεργοποιείται και το File Search)
    let run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });

    // 4) poll μέχρι να ολοκληρωθεί
    while (run.status === "queued" || run.status === "in_progress") {
      await new Promise(r => setTimeout(r, 700));
      run = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      if (run.status === "requires_action") {
        throw new Error("Assistant requested tool action (not handled in this route).");
      }
    }

    // 5) πάρε την τελευταία απάντηση
    const msgs = await openai.beta.threads.messages.list(thread.id, { limit: 1 });
    const reply = msgs.data?.[0]?.content?.[0]?.text?.value?.trim() || "…";

    res.json({ reply });
  } catch (e) {
    console.error("AI error:", e);
    res.status(500).send("AI error: " + (e?.message || e));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OK: GPT backend up on :${PORT}, assistant: ${ASSISTANT_ID}`));
