import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MASTER DB CONFIG (Same as in firebaseConfig.ts)
const MASTER_CONFIG = {
  apiKey: "AIzaSyB7xLE8XUD--62OYsbfOfAuTrgDSvlPW9Q",
  authDomain: "biztask-master.firebaseapp.com",
  projectId: "biztask-master",
  storageBucket: "biztask-master.firebasestorage.app",
  messagingSenderId: "233577905659",
  appId: "1:233577905659:web:3999de9f59e4539c61df5e",
  measurementId: "G-6SXQ2K18Z3"
};

const masterApp = initializeApp(MASTER_CONFIG, "SERVER_MASTER_APP");
const masterDb = getFirestore(masterApp);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // SePay Webhook
  app.post("/api/sepay-webhook", async (req, res) => {
    console.log("SePay Webhook received:", req.body);
    
    try {
      const { content } = req.body;
      
      if (!content) {
        return res.status(200).json({ success: false, message: "Missing content, ignoring" });
      }

      // Find company code from content (MD[companyCode])
      // Using regex to handle various formats like "Thanh toan MD COM123", "MDCOM123", etc.
      const match = content.match(/MD\s*([a-zA-Z0-9_-]+)/i);
      if (!match) {
        console.log("No specific company code found in content:", content);
        return res.status(200).json({ success: true, message: "No company code match" });
      }

      const companyCode = match[1].trim().toUpperCase();
      console.log("Extracted companyCode:", companyCode);

      // Verify company exists in Master DB
      const companyDocRef = doc(masterDb, 'companies', companyCode);
      const companyDoc = await getDoc(companyDocRef);
      
      if (!companyDoc.exists()) {
        console.error("Company not found in Master DB:", companyCode);
        return res.status(200).json({ success: false, message: "Company not found" });
      }

      // Get billing config for duration from Master DB
      const billingDoc = await getDoc(doc(masterDb, 'system_config', 'billing'));
      let durationDays = 365; // Default 1 year
      
      if (billingDoc.exists()) {
        const bData = billingDoc.data();
        durationDays = bData.durationDays || 365;
      }
      
      // Calculate new expiry date
      const data = companyDoc.data();
      let currentExpiry = data.expiredAt ? new Date(data.expiredAt) : new Date();
      if (currentExpiry < new Date()) currentExpiry = new Date(); 
      
      const newExpiry = new Date(currentExpiry);
      newExpiry.setDate(newExpiry.getDate() + durationDays);
      
      await updateDoc(companyDocRef, {
        expiredAt: newExpiry.toISOString()
      });

      console.log(`Successfully extended company ${companyCode} until ${newExpiry.toISOString()}`);
      res.json({ success: true, message: `Payment processed for ${companyCode}` });
    } catch (error) {
      console.error("Error processing SePay webhook:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
