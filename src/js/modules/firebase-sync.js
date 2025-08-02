// 1. Import the database instance and the necessary Firestore functions
import { db } from './firebase-init.js';
import { doc, setDoc, onSnapshot, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Queue for pending sync operations
const syncQueue = [];

// Function to process the sync queue
export async function processSyncQueue() {
  while (syncQueue.length > 0) {
    const { action, collectionName, document, documentId } = syncQueue.shift(); // Get the oldest task
    try {
      if (action === 'save') {
        const docRef = doc(db, collectionName, document.id);
        await setDoc(docRef, document);
        console.log(`Document ${document.id} synced to ${collectionName}`);
      } else if (action === 'delete') {
        const docRef = doc(db, collectionName, documentId);
        await deleteDoc(docRef);
        console.log(`Document ${documentId} deleted from ${collectionName}`);
      }
    } catch (error) {
      console.error(`Error processing sync queue for ${collectionName}:`, error);
      // Optional: Add failed task back to the queue for retry?
      // syncQueue.unshift({ action, collectionName, document, documentId });
    }
  }
}

// A generic function to save any document to a Firestore collection
export async function saveDocument(collectionName, document) {
  if (!document.id) {
    console.error("Document must have an 'id' property to be saved.", document);
    return;
  }
  // Add to queue instead of direct saving
  syncQueue.push({ action: 'save', collectionName, document });
  // No need to await here, queue will be processed in the background
}

// A generic function to delete a document from a Firestore collection
export async function deleteDocument(collectionName, documentId) {
  // Add to queue instead of direct deletion
  syncQueue.push({ action: 'delete', collectionName, documentId });
}

// A generic function to listen for real-time updates on an entire collection
export function listenToCollection(collectionName, callback) {
  const collRef = collection(db, collectionName);
  return onSnapshot(collRef, (snapshot) => {
    const items = [];
    snapshot.forEach((doc) => {
      items.push(doc.data());
    });
    // The callback will be executed every time the data changes in the cloud
    callback(items);
  });
  // The 'onSnapshot' function returns an 'unsubscribe' function.
  // You can call it later to stop listening for updates.
}
