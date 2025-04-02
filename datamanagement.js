let db;
const statusMessagesDiv = document.getElementById('statusMessages');

// --- IndexedDB Setup (Ensure version matches other files) ---
const request = indexedDB.open('TripTrackerDB', 3);

request.onupgradeneeded = (event) => {
    // No need to create stores here if they are guaranteed to exist
    // by javascript.js, but good practice to have checks if this
    // page could potentially be the first to initialize the DB.
    console.log('Data Management: DB upgrade needed (or initial setup). Version:', event.newVersion);
    // Add store/index creation checks if necessary, similar to other files.
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log('Data Management: Database opened successfully.');
    setupEventListeners(); // Setup button listeners
};

request.onerror = (event) => {
    console.error('Data Management: Error opening database:', event.target.error);
    displayStatusMessage('Error connecting to the database.', 'error');
};

// --- Helper Functions ---
function displayStatusMessage(message, type = 'info') {
    if (!statusMessagesDiv) return;
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    messageElement.className = `status-${type}`; // e.g., status-info, status-success, status-error
    statusMessagesDiv.appendChild(messageElement);
    // Optional: Auto-clear message after some time
    setTimeout(() => messageElement.remove(), 5000);
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // Feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up
    } else {
        displayStatusMessage('CSV download not supported by your browser.', 'error');
    }
}

function getDataFromStore(storeName, callback) {
    if (!db) return callback(new Error('Database not available'), null);
    try {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => callback(null, request.result);
        request.onerror = (event) => callback(event.target.error, null);
    } catch (error) {
        callback(error, null);
    }
}

function clearAndAddData(storeName, dataArray, callback) {
    if (!db) return callback(new Error('Database not available'));
    try {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const clearRequest = store.clear(); // Clear existing data first

        clearRequest.onsuccess = () => {
            console.log(`Store ${storeName} cleared.`);
            let itemsAdded = 0;
            if (dataArray.length === 0) {
                transaction.oncomplete = () => callback(null, 0); // No items to add
                return;
            }
            // Add new items
            dataArray.forEach(item => {
                // Remove the 'id' if the store uses autoIncrement,
                // otherwise IndexedDB might throw an error or overwrite.
                // Adjust based on your keyPath strategy.
                if (store.autoIncrement) {
                    delete item.id;
                }
                const addRequest = store.add(item);
                addRequest.onsuccess = () => {
                    itemsAdded++;
                    // Check if this is the last item inside the loop's success handler
                    // Note: transaction.oncomplete is more reliable for final confirmation
                };
                addRequest.onerror = (event) => {
                    console.error(`Error adding item to ${storeName}:`, item, event.target.error);
                    // Optionally stop the import or just log the error
                };
            });

            transaction.oncomplete = () => {
                console.log(`Transaction complete for ${storeName}. Items processed: ${itemsAdded}`);
                callback(null, itemsAdded);
            };
            transaction.onerror = (event) => {
                 console.error(`Transaction error during import to ${storeName}:`, event.target.error);
                 callback(event.target.error, itemsAdded);
            };
        };
        clearRequest.onerror = (event) => {
            console.error(`Error clearing store ${storeName}:`, event.target.error);
            callback(event.target.error, 0);
        };

    } catch (error) {
        callback(error, 0);
    }
}


// --- Export Functions ---

function exportTripsToCSV() {
    getDataFromStore('trips', (error, trips) => {
        if (error) {
            displayStatusMessage(`Error fetching trips: ${error.message}`, 'error');
            return;
        }
        if (!trips || trips.length === 0) {
            displayStatusMessage('No trip data to export.', 'info');
            return;
        }

        const headers = ['id', 'user', 'vehicle', 'startKm', 'endKm', 'customer', 'purpose', 'workDetails', 'startTime', 'endTime', 'date', 'status'];
        const csvData = Papa.unparse({
            fields: headers,
            data: trips.map(trip => headers.map(header => trip[header] ?? '')) // Handle missing fields
        });

        downloadCSV(csvData, 'trips_export.csv');
        displayStatusMessage(`Exported ${trips.length} trips.`, 'success');
    });
}

function exportCustomersToCSV() {
    getDataFromStore('customers', (error, customers) => {
        if (error) {
            displayStatusMessage(`Error fetching customers: ${error.message}`, 'error');
            return;
        }
        if (!customers || customers.length === 0) {
            displayStatusMessage('No customer data to export.', 'info');
            return;
        }

        // Handle nested contacts: Convert contacts array to JSON string for CSV
        const headers = ['id', 'name', 'address', 'contacts_json'];
        const csvData = Papa.unparse({
            fields: headers,
            data: customers.map(cust => [
                cust.id ?? '',
                cust.name ?? '',
                cust.address ?? '',
                JSON.stringify(cust.contacts || []) // Convert contacts array to JSON string
            ])
        });

        downloadCSV(csvData, 'customers_export.csv');
        displayStatusMessage(`Exported ${customers.length} customers.`, 'success');
    });
}

function exportVehiclesToCSV() {
    getDataFromStore('vehicles', (error, vehicles) => {
        if (error) {
            displayStatusMessage(`Error fetching vehicles: ${error.message}`, 'error');
            return;
        }
        if (!vehicles || vehicles.length === 0) {
            displayStatusMessage('No vehicle data to export.', 'info');
            return;
        }

        const headers = ['id', 'name', 'currentKm'];
         const csvData = Papa.unparse({
            fields: headers,
            data: vehicles.map(v => headers.map(header => v[header] ?? ''))
        });

        downloadCSV(csvData, 'vehicles_export.csv');
        displayStatusMessage(`Exported ${vehicles.length} vehicles.`, 'success');
    });
}

// --- Import Functions ---

function importFromCSV(file, storeName, expectedHeaders, dataProcessor) {
    if (!file) {
        displayStatusMessage('No file selected.', 'error');
        return;
    }
    if (!Papa) {
         displayStatusMessage('CSV Parsing library (PapaParse) not loaded.', 'error');
         return;
    }

    Papa.parse(file, {
        header: true, // Assumes first row is header
        skipEmptyLines: true,
        complete: (results) => {
            if (results.errors.length > 0) {
                console.error('CSV Parsing errors:', results.errors);
                displayStatusMessage(`Error parsing CSV: ${results.errors[0].message}`, 'error');
                return;
            }

            const headers = results.meta.fields;
            // Basic header validation
            if (!expectedHeaders.every(h => headers.includes(h))) {
                 displayStatusMessage(`CSV file is missing expected headers. Required: ${expectedHeaders.join(', ')}`, 'error');
                 return;
            }

            try {
                const processedData = results.data.map(dataProcessor); // Process each row
                // Import data (replace existing)
                clearAndAddData(storeName, processedData, (error, count) => {
                    if (error) {
                        displayStatusMessage(`Error importing data to ${storeName}: ${error.message}`, 'error');
                    } else {
                        displayStatusMessage(`Successfully imported ${count} records into ${storeName}.`, 'success');
                    }
                });
            } catch (processingError) {
                 displayStatusMessage(`Error processing CSV data: ${processingError.message}`, 'error');
            }
        },
        error: (error) => {
            displayStatusMessage(`CSV parsing failed: ${error.message}`, 'error');
        }
    });
}

// Data Processors for Import (Convert CSV row to DB object)
function processTripData(row) {
    // Convert types, handle missing data
    return {
        // id: parseInt(row.id) || undefined, // Let DB handle ID if autoIncrement
        user: row.user || 'Unknown',
        vehicle: row.vehicle || 'Unknown',
        startKm: parseInt(row.startKm) || 0,
        endKm: parseInt(row.endKm) || 0,
        customer: row.customer || 'Unknown',
        purpose: row.purpose || '',
        workDetails: row.workDetails || '',
        startTime: row.startTime || new Date(0).toISOString(), // Default or handle invalid dates
        endTime: row.endTime || new Date(0).toISOString(),
        date: row.date || new Date(0).toISOString(),
        status: row.status || 'completed'
    };
}

function processCustomerData(row) {
    let contacts = [];
    try {
        // Parse the JSON string back into an array
        contacts = JSON.parse(row.contacts_json || '[]');
        if (!Array.isArray(contacts)) contacts = []; // Ensure it's an array
    } catch (e) {
        console.warn('Could not parse contacts_json for customer:', row.name, e);
        contacts = []; // Default to empty array on error
    }
    return {
        // id: parseInt(row.id) || undefined,
        name: row.name || 'Unknown',
        address: row.address || '',
        contacts: contacts
    };
}

function processVehicleData(row) {
    return {
        // id: parseInt(row.id) || undefined,
        name: row.name || 'Unknown',
        currentKm: parseInt(row.currentKm) || 0
    };
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    // Export Buttons
    document.getElementById('exportTripsBtn')?.addEventListener('click', exportTripsToCSV);
    document.getElementById('exportCustomersBtn')?.addEventListener('click', exportCustomersToCSV);
    document.getElementById('exportVehiclesBtn')?.addEventListener('click', exportVehiclesToCSV);

    // Import File Inputs (listen for changes)
    document.getElementById('importTripsFile')?.addEventListener('change', (event) => {
        importFromCSV(event.target.files[0], 'trips', ['user', 'vehicle', 'startKm', 'endKm', 'customer'], processTripData);
        event.target.value = null; // Reset file input
    });
    document.getElementById('importCustomersFile')?.addEventListener('change', (event) => {
        importFromCSV(event.target.files[0], 'customers', ['name', 'address', 'contacts_json'], processCustomerData);
         event.target.value = null; // Reset file input
    });
    document.getElementById('importVehiclesFile')?.addEventListener('change', (event) => {
        importFromCSV(event.target.files[0], 'vehicles', ['name', 'currentKm'], processVehicleData);
         event.target.value = null; // Reset file input
    });

    // Clear Database Button
    document.getElementById('clearDatabaseBtn')?.addEventListener('click', clearEntireDatabase);
}

// --- Database Clearing Function ---
function clearEntireDatabase() {
    if (!db) {
        displayStatusMessage('Database not available.', 'error');
        return;
    }

    // Confirmation dialog
    if (!confirm('WARNING: This will permanently delete ALL data (Trips, Customers, Vehicles) from the database. This action cannot be undone. Are you absolutely sure?')) {
        displayStatusMessage('Database clearing cancelled.', 'info');
        return;
    }

    // Double confirmation for safety
    if (!confirm('SECOND WARNING: Please confirm again that you want to erase all data.')) {
        displayStatusMessage('Database clearing cancelled.', 'info');
        return;
    }

    displayStatusMessage('Attempting to clear database...', 'info');

    try {
        const storeNames = Array.from(db.objectStoreNames);
        if (storeNames.length === 0) {
            displayStatusMessage('No data stores found in the database.', 'info');
            return;
        }

        const transaction = db.transaction(storeNames, 'readwrite');
        let storesCleared = 0;
        let errorsOccurred = false;

        storeNames.forEach(storeName => {
            const request = transaction.objectStore(storeName).clear();
            request.onsuccess = () => {
                console.log(`Store '${storeName}' cleared successfully.`);
                storesCleared++;
            };
            request.onerror = (event) => {
                console.error(`Error clearing store '${storeName}':`, event.target.error);
                errorsOccurred = true;
                // Don't abort the whole transaction, try to clear other stores
            };
        });

        transaction.oncomplete = () => {
            if (errorsOccurred) {
                displayStatusMessage(`Database clearing finished with some errors. ${storesCleared}/${storeNames.length} stores cleared. Check console for details. LocalStorage NOT cleared due to errors.`, 'error');
            } else {
                // Clear localStorage only if IndexedDB clearing was fully successful
                try {
                    localStorage.clear();
                    console.log('LocalStorage cleared successfully.');
                    displayStatusMessage(`Successfully cleared all data from ${storesCleared} IndexedDB stores and LocalStorage.`, 'success');
                } catch (storageError) {
                    console.error('Error clearing LocalStorage:', storageError);
                    displayStatusMessage(`Successfully cleared IndexedDB stores, but failed to clear LocalStorage: ${storageError.message}`, 'error');
                }
                // Optionally, reload the page or update UI elements if needed elsewhere
            }
        };

        transaction.onerror = (event) => {
            console.error('Transaction error during database clearing:', event.target.error);
            displayStatusMessage(`Failed to clear database due to a transaction error: ${event.target.error}`, 'error');
        };

    } catch (error) {
        console.error('Error initiating database clearing:', error);
        displayStatusMessage(`An unexpected error occurred while trying to clear the database: ${error.message}`, 'error');
    }
} 