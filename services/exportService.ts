
import * as XLSX from 'xlsx';
import { db } from './firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";

export const exportAllDataToExcel = async (companyId: string, companyName: string) => {
  const collections = [
    'users',
    'tasks',
    'partners',
    'customers',
    'partner_transactions',
    'customer_transactions',
    'attendance',
    'advance_payments',
    'payrolls',
    'inventoryItems',
    'inventoryTransactions'
  ];

  const workbook = XLSX.utils.book_new();

  for (const colName of collections) {
    const q = query(collection(db!, colName), where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, colName);
    }
  }

  const fileName = `Dữ liệu ${companyName}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
