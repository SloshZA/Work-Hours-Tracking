let db;

const request = indexedDB.open('TripTrackerDB', 1);

request.onupgradeneeded = (event) => {
    console.log('App.js: DB upgrade needed.');
    db = event.target.result;
    if (!db.objectStoreNames.contains('trips')) {
        db.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log('App.js: Database opened successfully for Main Page.');
    initializeUI();
};

request.onerror = (event) => {
    console.error('App.js: Error opening database:', event.target.error);
    alert('Database could not be opened. Please check console for errors.');
};

function saveTrip(trip, callback) {
    if (!db) {
        console.error('App.js: Database not initialized.');
        alert('Database error. Cannot save trip.');
        if (callback) callback(false);
        return;
    }
    let transaction;
    try {
        transaction = db.transaction(['trips'], 'readwrite');
        console.log('App.js: Save transaction started.');
        const store = transaction.objectStore('trips');
        const request = store.add(trip);

        request.onsuccess = () => {
            console.log('App.js: Trip add request successful.');
        };
        request.onerror = (event) => {
            console.error('App.js: Error saving trip in request:', event.target.error);
        };

        transaction.oncomplete = () => {
            console.log('App.js: Save transaction completed successfully.');
            if (callback) callback(true);
        };
        transaction.onerror = (event) => {
            console.error('App.js: Save transaction error:', event.target.error);
            if (callback) callback(false);
        };

    } catch (error) {
        console.error('App.js: Error creating save transaction:', error);
        alert('Database transaction error during save.');
        if (callback) callback(false);
    }
}

function getTrips(callback) {
    if (!db) {
        console.error('Database not initialized.');
        alert('Database error. Cannot get trips.');
        return;
    }
    const transaction = db.transaction(['trips'], 'readonly');
    const store = transaction.objectStore('trips');
    const request = store.getAll();

    request.onsuccess = () => {
        callback(request.result);
    };
    request.onerror = (event) => {
        console.error('Error getting trips:', event.target.error);
        callback([]); // Return empty array on error
    };
}

function saveCustomer(customer, callback) {
    if (!db) {
        console.error('Database not initialized.');
        alert('Database error. Cannot save customer.');
        return;
    }
    const transaction = db.transaction(['customers'], 'readwrite');
    const store = transaction.objectStore('customers');
    const request = store.add(customer);

    request.onsuccess = () => {
        console.log('Customer saved successfully');
        if (callback) callback(true);
    };
    request.onerror = (event) => {
        console.error('Error saving customer:', event.target.error);
        if (callback) callback(false);
    };
}

function getCustomers(callback) {
    if (!db) {
        console.error('Database not initialized.');
        alert('Database error. Cannot get customers.');
        return;
    }
    const transaction = db.transaction(['customers'], 'readonly');
    const store = transaction.objectStore('customers');
    const request = store.getAll();

    request.onsuccess = () => {
        callback(request.result);
    };
    request.onerror = (event) => {
        console.error('Error getting customers:', event.target.error);
        callback([]); // Return empty array on error
    };
}

// --- New Function: Populate Customer Dropdown ---
function populateCustomerDropdown(customers) {
    const selectElement = document.getElementById('customerSelect');
    // Clear existing options except the default
    selectElement.innerHTML = '<option value="">-- Select Customer --</option>';

    if (customers && customers.length > 0) {
        customers.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.name; // Use name as value for simplicity
            option.textContent = customer.name;
            // You might store customer.id in option.value if needed later
            selectElement.appendChild(option);
        });
    }
    console.log('App.js: Customer dropdown populated.');
}

// Function to initialize UI elements and add event listeners
function initializeUI() {
    const startKmInput = document.getElementById('startKmInput');
    const endKmInput = document.getElementById('endKmInput');
    const customerSelect = document.getElementById('customerSelect');
    const purposeInput = document.getElementById('purposeInput');
    const saveTripBtn = document.getElementById('saveTripBtn');
    const viewTripsBtn = document.getElementById('viewTripsBtn');
    const manageCustomersBtn = document.getElementById('manageCustomersBtn');
    const importTripBtn = document.getElementById('importTripBtn');

    // --- Populate dropdown on load ---
    getCustomers(populateCustomerDropdown);

    saveTripBtn.addEventListener('click', () => {
        const startKm = startKmInput.value;
        const endKm = endKmInput.value;
        const customer = customerSelect.value;
        const purpose = purposeInput.value.trim();

        if (!customer) {
            alert('Please select a customer.');
            return;
        }

        if (startKm && endKm && customer && purpose) {
            if (isNaN(parseInt(startKm)) || isNaN(parseInt(endKm))) {
                alert('Start KM and End KM must be numbers.');
                return;
            }
            if (parseInt(endKm) < parseInt(startKm)) {
                alert('End KM cannot be less than Start KM.');
                return;
            }

            const trip = {
                startKm: parseInt(startKm),
                endKm: parseInt(endKm),
                customer,
                purpose,
                date: new Date().toISOString()
            };
            saveTrip(trip, (success) => {
                if (success) {
                    alert('Trip saved successfully!');
                    startKmInput.value = '';
                    endKmInput.value = '';
                    customerSelect.value = '';
                    purposeInput.value = '';

                    console.log('App.js: Attempting to read trips immediately after save...');
                    getTrips((trips) => {
                        console.log('App.js: Trips found immediately after save:', trips);
                    });

                } else {
                    alert('Failed to save trip.');
                }
            });
        } else {
            if (!startKm || !endKm || !purpose) {
                alert('All fields except customer selection are required.');
            }
        }
    });

    viewTripsBtn.addEventListener('click', () => {
        window.location.href = 'tripsheet.html';
    });

    manageCustomersBtn.addEventListener('click', () => {
        const customerName = prompt('Enter Customer Name:');
        const contact = prompt('Enter Contact Info (optional):');

        if (customerName) {
            const customer = {
                name: customerName.trim(),
                contact: contact ? contact.trim() : ''
            };
            saveCustomer(customer, (success) => {
                if (success) {
                    alert('Customer saved successfully!');
                    getCustomers(populateCustomerDropdown);
                } else {
                    alert('Failed to save customer.');
                }
            });
        } else {
            alert('Customer name is required.');
        }
    });

    importTripBtn.addEventListener('click', () => {
        const apiKey = 'YOUR_GOOGLE_MAPS_API_KEY'; // Replace with your API key
        const startDate = prompt('Enter Start Date (YYYY-MM-DD):');
        const endDate = prompt('Enter End Date (YYYY-MM-DD):');

        if (startDate && endDate) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
                alert('Invalid date format. Please use YYYY-MM-DD.');
                return;
            }

            console.log(`Fetching timeline data for ${startDate} to ${endDate}`);
            alert('Google Maps import functionality is not fully implemented yet.');
        } else {
            alert('Start and end dates are required.');
        }
    });
}
