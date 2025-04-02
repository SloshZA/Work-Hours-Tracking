let db;

const request = indexedDB.open('TripTrackerDB', 2);

request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains('trips')) {
        db.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('vehicles')) {
        db.createObjectStore('vehicles', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'id' });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log('Database opened successfully');
    
    // Initialize vehicle dropdown after the database is ready
    populateVehicleDropdown();
};

request.onerror = (event) => {
    console.error('Error opening database:', event.target.error);
};

function saveTrip(trip) {
    const transaction = db.transaction(['trips'], 'readwrite');
    const store = transaction.objectStore('trips');
    store.add(trip);
    
    // Save the selected vehicle as preference
    if (trip.vehicle) {
        savePreference('lastVehicle', trip.vehicle);
        console.log('Saved lastVehicle preference:', trip.vehicle);
    }
}

function getTrips(callback) {
    const transaction = db.transaction(['trips'], 'readonly');
    const store = transaction.objectStore('trips');
    const request = store.getAll();

    request.onsuccess = () => {
        callback(request.result);
    };
}

function saveCustomer(customer) {
    const transaction = db.transaction(['customers'], 'readwrite');
    const store = transaction.objectStore('customers');
    store.add(customer);
}

function getCustomers(callback) {
    const transaction = db.transaction(['customers'], 'readonly');
    const store = transaction.objectStore('customers');
    const request = store.getAll();

    request.onsuccess = () => {
        callback(request.result);
    };
}

function saveVehicle(vehicle) {
    const transaction = db.transaction(['vehicles'], 'readwrite');
    const store = transaction.objectStore('vehicles');
    store.add(vehicle);
}

function getVehicles(callback) {
    const transaction = db.transaction(['vehicles'], 'readonly');
    const store = transaction.objectStore('vehicles');
    const request = store.getAll();

    request.onsuccess = () => {
        callback(request.result);
    };
}

function savePreference(key, value) {
    const transaction = db.transaction(['preferences'], 'readwrite');
    const store = transaction.objectStore('preferences');
    
    const preference = {
        id: key,
        value: value
    };
    
    const request = store.put(preference);
    request.onsuccess = () => {
        console.log(`Preference saved: ${key} = ${value}`);
    };
    
    request.onerror = (event) => {
        console.error(`Error saving preference ${key}:`, event.target.error);
    };
}

function getPreference(key, callback) {
    if (!db) {
        console.error('Database not available');
        if (callback) callback(null);
        return;
    }
    
    try {
        const transaction = db.transaction(['preferences'], 'readonly');
        const store = transaction.objectStore('preferences');
        const request = store.get(key);
        
        request.onsuccess = () => {
            const result = request.result ? request.result.value : null;
            console.log(`Retrieved preference ${key}:`, result);
            if (callback) callback(result);
        };
        
        request.onerror = (event) => {
            console.error(`Error getting preference ${key}:`, event.target.error);
            if (callback) callback(null);
        };
    } catch (error) {
        console.error(`Exception getting preference ${key}:`, error);
        if (callback) callback(null);
    }
}

// Load vehicles into dropdown
function populateVehicleDropdown() {
    const vehicleSelect = document.getElementById('vehicleSelect');
    if (!vehicleSelect) {
        console.warn('Vehicle select element not found');
        return;
    }
    
    getVehicles((vehicles) => {
        console.log('Retrieved vehicles:', vehicles);
        
        // Clear existing options except the default
        vehicleSelect.innerHTML = '<option value="">-- Select Vehicle --</option>';
        
        if (vehicles && vehicles.length > 0) {
            vehicles.forEach(vehicle => {
                const option = document.createElement('option');
                option.value = vehicle.name;
                option.textContent = vehicle.name;
                // Store the current KM as a data attribute
                option.dataset.currentKm = vehicle.currentKm || '';
                vehicleSelect.appendChild(option);
            });
            
            // Set to last used vehicle if available
            getPreference('lastVehicle', (lastVehicle) => {
                if (lastVehicle) {
                    console.log('Attempting to set vehicle to:', lastVehicle);
                    
                    // Check if the option exists
                    const option = vehicleSelect.querySelector(`option[value="${lastVehicle}"]`);
                    if (option) {
                        console.log('Found matching option, setting value');
                        vehicleSelect.value = lastVehicle;
                        
                        // Trigger change event
                        const event = new Event('change');
                        vehicleSelect.dispatchEvent(event);
                    } else {
                        console.warn('No option found for lastVehicle:', lastVehicle);
                    }
                } else {
                    console.log('No lastVehicle preference found');
                }
            });
        } else {
            console.log('No vehicles found in database');
        }
    });
}

document.getElementById('startTripBtn').addEventListener('click', () => {
    const startKm = prompt('Enter Start KM:');
    const endKm = prompt('Enter End KM:');
    const customer = prompt('Enter Customer Name:');
    const purpose = prompt('Enter Purpose:');
    const vehicle = document.getElementById('vehicleSelect').value;

    if (startKm && endKm && customer && purpose && vehicle) {
        const trip = {
            startKm: parseInt(startKm),
            endKm: parseInt(endKm),
            customer,
            purpose,
            vehicle,
            date: new Date().toISOString()
        };
        saveTrip(trip);
        alert('Trip saved successfully!');
        
        // Refresh the dropdown to ensure it's up to date
        setTimeout(populateVehicleDropdown, 500);
    } else {
        alert('All fields are required.');
    }
});

document.getElementById('viewTripsBtn').addEventListener('click', () => {
    getTrips((trips) => {
        if (trips.length > 0) {
            alert(JSON.stringify(trips, null, 2));
        } else {
            alert('No trips found.');
        }
    });
});

document.getElementById('manageCustomersBtn').addEventListener('click', () => {
    const customerName = prompt('Enter Customer Name:');
    const contact = prompt('Enter Contact Info:');

    if (customerName) {
        const customer = {
            name: customerName,
            contact
        };
        saveCustomer(customer);
        alert('Customer saved successfully!');
    } else {
        alert('Customer name is required.');
    }
});

document.getElementById('importTripBtn').addEventListener('click', () => {
    const apiKey = 'YOUR_GOOGLE_MAPS_API_KEY'; // Replace with your API key
    const startDate = prompt('Enter Start Date (YYYY-MM-DD):');
    const endDate = prompt('Enter End Date (YYYY-MM-DD):');

    if (startDate && endDate) {
        fetch(`https://maps.googleapis.com/maps/api/timeline/v1?key=${apiKey}&startDate=${startDate}&endDate=${endDate}`)
            .then(response => response.json())
            .then(data => {
                if (data.trips && data.trips.length > 0) {
                    const trip = data.trips[0]; // Use the first trip for simplicity
                    const startKm = trip.startLocation.latitude; // Example: Use latitude as start KM
                    const endKm = trip.endLocation.latitude; // Example: Use latitude as end KM
                    const customer = prompt('Enter Customer Name:');
                    const purpose = prompt('Enter Purpose:');
                    const vehicle = document.getElementById('vehicleSelect').value;

                    if (customer && purpose && vehicle) {
                        const newTrip = {
                            startKm,
                            endKm,
                            customer,
                            purpose,
                            vehicle,
                            date: new Date().toISOString()
                        };
                        saveTrip(newTrip);
                        alert('Trip imported and saved successfully!');
                    } else {
                        alert('Customer, purpose, and vehicle are required.');
                    }
                } else {
                    alert('No trips found in the specified date range.');
                }
            })
            .catch(error => {
                console.error('Error fetching trip data:', error);
                alert('Failed to import trip data.');
            });
    } else {
        alert('Start and end dates are required.');
    }
});

// Make sure this doesn't conflict with the initialization in onsuccess
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if the database is already available
    if (db) {
        console.log('DOMContentLoaded: Database already available, populating dropdown');
        populateVehicleDropdown();
    } else {
        console.log('DOMContentLoaded: Database not yet available, will initialize in onsuccess');
    }
});
