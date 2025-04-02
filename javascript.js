let db;

const request = indexedDB.open('TripTrackerDB', 1);

request.onupgradeneeded = (event) => {
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
};

request.onerror = (event) => {
    console.error('Error opening database:', event.target.error);
};

function saveTrip(trip) {
    const transaction = db.transaction(['trips'], 'readwrite');
    const store = transaction.objectStore('trips');
    store.add(trip);
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

document.getElementById('startTripBtn').addEventListener('click', () => {
    const startKm = prompt('Enter Start KM:');
    const endKm = prompt('Enter End KM:');
    const customer = prompt('Enter Customer Name:');
    const purpose = prompt('Enter Purpose:');

    if (startKm && endKm && customer && purpose) {
        const trip = {
            startKm: parseInt(startKm),
            endKm: parseInt(endKm),
            customer,
            purpose,
            date: new Date().toISOString()
        };
        saveTrip(trip);
        alert('Trip saved successfully!');
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

                    if (customer && purpose) {
                        const newTrip = {
                            startKm,
                            endKm,
                            customer,
                            purpose,
                            date: new Date().toISOString()
                        };
                        saveTrip(newTrip);
                        alert('Trip imported and saved successfully!');
                    } else {
                        alert('Customer and purpose are required.');
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
