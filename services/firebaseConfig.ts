
import { initializeApp, getApps, deleteApp, FirebaseApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// --- MASTER APP CONFIG (Lễ tân) ---
const MASTER_CONFIG = {
  apiKey: "AIzaSyB7xLE8XUD--62OYsbfOfAuTrgDSvlPW9Q",
  authDomain: "biztask-master.firebaseapp.com",
  projectId: "biztask-master",
  storageBucket: "biztask-master.firebasestorage.app",
  messagingSenderId: "233577905659",
  appId: "1:233577905659:web:3999de9f59e4539c61df5e",
  measurementId: "G-6SXQ2K18Z3"
};

// Khởi tạo Master App
let masterApp: FirebaseApp;
let masterDb: Firestore;

const initMaster = () => {
  const apps = getApps();
  const existingMaster = apps.find(a => a.name === "MASTER_APP");
  if (existingMaster) {
    masterApp = existingMaster;
  } else {
    masterApp = initializeApp(MASTER_CONFIG, "MASTER_APP");
  }
  masterDb = getFirestore(masterApp);
};
initMaster();

// --- TENANT APP CONFIG (Văn phòng công ty) ---
const STORAGE_KEY = 'biz_firebase_config_v1';

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

const initFirebase = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved || saved === 'RESET') {
      return false;
    }

    const config = JSON.parse(saved);
    const companyCode = localStorage.getItem('biz_company_code') || "[DEFAULT]";
    const apps = getApps();
    const existingApp = apps.find(a => a.name === companyCode);
    
    if (existingApp) {
      app = existingApp;
    } else {
      app = initializeApp(config, companyCode);
    }
    
    db = getFirestore(app);
    storage = getStorage(app);
    console.log(`Tenant Firebase initialized for ${companyCode}`);
    return true;
  } catch (e) {
    console.error("Failed to initialize Tenant Firebase", e);
    if (localStorage.getItem(STORAGE_KEY)) {
        localStorage.removeItem(STORAGE_KEY);
    }
    return false;
  }
};

// Khởi tạo ngay lập tức
initFirebase();

// --- CÁC HÀM XỬ LÝ SAAS ---

// Dành cho Nhân viên: Lấy config từ Master DB bằng Mã Công Ty
export const joinCompany = async (companyCode: string): Promise<boolean> => {
  try {
    const cleanCode = companyCode.trim();
    if (!cleanCode) throw new Error("Vui lòng nhập mã công ty");

    const docRef = doc(masterDb, "companies", cleanCode);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Mã công ty không tồn tại. Vui lòng kiểm tra lại!");
    }

    const data = docSnap.data();
    if (!data || !data.config) {
      throw new Error("Dữ liệu công ty bị lỗi.");
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.config));
    localStorage.setItem('biz_company_code', cleanCode);
    return initFirebase();
  } catch (error: any) {
    console.error("Error joining company:", error);
    throw error;
  }
};

// Dành cho Giám đốc: Đăng ký Mã Công Ty mới và lưu config lên Master DB
export const registerCompany = async (companyCode: string, configInput: string): Promise<boolean> => {
  try {
    const cleanCode = companyCode.trim();
    if (!cleanCode) throw new Error("Vui lòng nhập mã công ty");
    if (cleanCode.length < 3) throw new Error("Mã công ty phải có ít nhất 3 ký tự");

    // 1. Parse và Validate JSON Config
    let cleanString = configInput.trim();
    const startIndex = cleanString.indexOf('{');
    const endIndex = cleanString.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      cleanString = cleanString.substring(startIndex, endIndex + 1);
    } else {
        if (cleanString.includes(':')) {
            cleanString = `{${cleanString}}`;
        }
    }

    let config: any;
    try {
        config = JSON.parse(cleanString);
    } catch (jsonError) {
        let jsonString = cleanString;
        jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        jsonString = jsonString.replace(/'/g, '"');
        jsonString = jsonString.replace(/,\s*}/g, '}');
        jsonString = jsonString.replace(/,\s*]/g, ']');
        try {
            config = JSON.parse(jsonString);
        } catch (fixError) {
            throw new Error("Định dạng JSON cấu hình không hợp lệ.");
        }
    }
    
    if (!config.apiKey || !config.projectId) {
      throw new Error("Cấu hình thiếu apiKey hoặc projectId");
    }

    // 2. Kiểm tra xem Mã Công Ty đã tồn tại chưa
    const docRef = doc(masterDb, "companies", cleanCode);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      throw new Error("Mã công ty này đã có người sử dụng. Vui lòng chọn mã khác!");
    }

    // 3. Lưu lên Master DB
    const creationTime = new Date().toISOString();

    await setDoc(docRef, {
      config: config,
      createdAt: creationTime,
      expiredAt: creationTime // Ban đầu expiredAt = createdAt
    });

    // 4. Lưu vào máy và khởi tạo
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    localStorage.setItem('biz_company_code', cleanCode);
    return initFirebase();
  } catch (error: any) {
    console.error("Error registering company:", error);
    throw error;
  }
};

// Dành cho Giám đốc: Cập nhật cấu hình Firebase cho Mã Công Ty hiện tại
export const updateCompanyConfig = async (companyCode: string, configInput: string): Promise<boolean> => {
  try {
    const cleanCode = companyCode.trim();
    if (!cleanCode) throw new Error("Mã công ty không hợp lệ");

    // 1. Parse và Validate JSON Config
    let cleanString = configInput.trim();
    const startIndex = cleanString.indexOf('{');
    const endIndex = cleanString.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      cleanString = cleanString.substring(startIndex, endIndex + 1);
    } else {
        if (cleanString.includes(':')) {
            cleanString = `{${cleanString}}`;
        }
    }

    let config: any;
    try {
        config = JSON.parse(cleanString);
    } catch (jsonError) {
        let jsonString = cleanString;
        jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        jsonString = jsonString.replace(/'/g, '"');
        jsonString = jsonString.replace(/,\s*}/g, '}');
        jsonString = jsonString.replace(/,\s*]/g, ']');
        try {
            config = JSON.parse(jsonString);
        } catch (fixError) {
            throw new Error("Định dạng JSON cấu hình không hợp lệ.");
        }
    }
    
    if (!config.apiKey || !config.projectId) {
      throw new Error("Cấu hình thiếu apiKey hoặc projectId");
    }

    // 2. Cập nhật lên Master DB
    const docRef = doc(masterDb, "companies", cleanCode);
    await setDoc(docRef, {
      config: config,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // 3. Lưu vào máy
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    
    // 4. Xóa app cũ nếu có để khởi tạo lại
    if (app) {
      try {
        await deleteApp(app);
      } catch (e) {
        console.error("Failed to delete app", e);
      }
    }
    
    return initFirebase();
  } catch (error: any) {
    console.error("Error updating company config:", error);
    throw error;
  }
};

export const resetFirebaseConfig = async () => {
  localStorage.setItem(STORAGE_KEY, 'RESET');
  
  if (app) {
    try {
      await deleteApp(app);
      app = undefined;
      db = undefined;
      storage = undefined;
    } catch (e) {
      console.error("Failed to delete app", e);
    }
  }
  
  window.location.href = window.location.pathname;
};

export const isConfigured = () => !!db;

export { db, storage, masterDb };
