import express from "express";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

// MASTER DB CONFIG
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

const app = express();
// Render assigns a dynamic port via the PORT environment variable
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint for Render
app.get('/', (req, res) => {
  res.send('BizTask SePay Webhook Server is running!');
});

// Middleware xác thực bảo mật từ SePay
const verifySePayToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Cấu hình SEPAY_API_TOKEN trên Render Environment Variables
  const expectedToken = process.env.SEPAY_API_TOKEN; 

  if (!expectedToken) {
    console.warn("WARNING: SEPAY_API_TOKEN is not set on the server.");
    // Trong môi trường dev, có thể tạm pass nếu chưa có token, nhưng CẦN thiết lập trên Render
    return res.status(500).json({ success: false, message: "Server misconfiguration" });
  }

  // SePay thường gửi header dưới dạng "Apikey <TOKEN>" hoặc "Bearer <TOKEN>"
  if (!authHeader || !authHeader.includes(expectedToken)) {
    console.error("Unauthorized webhook attempt.");
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid API Token" });
  }

  next();
};

// SePay Webhook Endpoint (đã bảo mật)
app.post("/api/sepay-webhook", verifySePayToken, async (req, res) => {
  console.log("SePay Webhook received:", req.body);
  
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(200).json({ success: false, message: "Missing content, ignoring" });
    }

    // Match BIZTASK hoặc MD kèm mã công ty
    const match = content.match(/(?:MD|BIZTASK)\s*([a-zA-Z0-9_-]+)/i);
    if (!match) {
      console.log("No specific company code found in content:", content);
      return res.status(200).json({ success: true, message: "No company code match" });
    }

    const rawCompanyCode = match[1].trim();
    console.log("Extracted companyCode:", rawCompanyCode);

    // Tìm kiếm trong bộ Master Database với mọi định dạng Hoa/Thường
    let companyDocRef = doc(masterDb, 'companies', rawCompanyCode);
    let companyDoc = await getDoc(companyDocRef);
    
    if (!companyDoc.exists()) {
      companyDocRef = doc(masterDb, 'companies', rawCompanyCode.toLowerCase());
      companyDoc = await getDoc(companyDocRef);
    }
    
    if (!companyDoc.exists()) {
      companyDocRef = doc(masterDb, 'companies', rawCompanyCode.toUpperCase());
      companyDoc = await getDoc(companyDocRef);
    }

    if (!companyDoc.exists()) {
      console.error("Company not found in Master DB:", rawCompanyCode);
      return res.status(200).json({ success: false, message: "Company not found" });
    }

    // Lấy thông tin cấu hình giá gốc từ DB
    const billingDoc = await getDoc(doc(masterDb, 'system_config', 'billing'));
    let durationDays = 365; // Mặc định 1 năm
    
    if (billingDoc.exists()) {
      const bData = billingDoc.data();
      durationDays = bData.durationDays || 365;
    }
    
    // Tính toán ngày hết hạn mới
    const data = companyDoc.data();
    let currentExpiry = data.expiredAt ? new Date(data.expiredAt) : new Date();
    if (currentExpiry < new Date()) currentExpiry = new Date(); // Nếu đã hết hạn thì cộng từ hôm nay
    
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + durationDays);
    
    // Cập nhật lên Master DB
    await updateDoc(companyDocRef, {
      expiredAt: newExpiry.toISOString()
    });

    console.log(`Successfully extended company ${companyDoc.id} until ${newExpiry.toISOString()}`);
    res.json({ success: true, message: `Payment processed for ${companyDoc.id}` });
  } catch (error) {
    console.error("Error processing SePay webhook:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Webhook Server running on port ${PORT}`);
});
