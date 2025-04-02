let db;

// --- IndexedDB Setup (Similar to app.js) ---
const request = indexedDB.open('TripTrackerDB', 1);

request.onupgradeneeded = (event) => {
    console.log('TripSheet: DB upgrade needed.'); // Log upgrade
    const dbInstance = event.target.result;
    if (!dbInstance.objectStoreNames.contains('trips')) {
        dbInstance.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
    }
    if (!dbInstance.objectStoreNames.contains('customers')) {
        dbInstance.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log('TripSheet: Database opened successfully.'); // Log success

    // *** ADD A SMALL DELAY ***
    // Wait a fraction of a second before trying to load data
    setTimeout(() => {
        console.log('TripSheet: Delay finished, calling loadAndDisplayTrips.');
        loadAndDisplayTrips();
    }, 100); // 100 milliseconds delay (adjust if needed)

};

request.onerror = (event) => {
    console.error('TripSheet: Error opening database:', event.target.error); // Log error
    displayErrorMessage('Could not load trip data. Database error.');
};

// --- Data Fetching ---
function getTrips(callback) {
    console.log('TripSheet: getTrips called.'); // Log function call
    if (!db) {
        console.error('TripSheet: Database not initialized in getTrips.'); // Log DB state
        displayErrorMessage('Database error. Cannot get trips.');
        callback([]);
        return;
    }
    try {
        const transaction = db.transaction(['trips'], 'readonly');
        console.log('TripSheet: Read transaction started.'); // Log transaction start
        const store = transaction.objectStore('trips');
        const request = store.getAll();

        request.onsuccess = () => {
            console.log('TripSheet: getAll request successful. Found trips:', request.result); // Log retrieved data
            callback(request.result);
        };
        request.onerror = (event) => {
            console.error('TripSheet: Error getting trips in getAll request:', event.target.error); // Log request error
            displayErrorMessage('Failed to retrieve trips from the database.');
            callback([]);
        };
        transaction.onerror = (event) => {
             console.error('TripSheet: Read transaction error:', event.target.error); // Log transaction error
        };
        transaction.oncomplete = () => {
             console.log('TripSheet: Read transaction complete.'); // Log transaction complete
        };

    } catch (error) {
        console.error('TripSheet: Error creating transaction:', error); // Log transaction creation error
        displayErrorMessage('Database transaction error.');
        callback([]);
    }
}

// --- UI Display ---
function displayTripsTable(trips) {
    console.log('TripSheet: displayTripsTable called with trips:', trips); // Log data passed to display
    const container = document.getElementById('tripsListContainer');
    container.innerHTML = '';

    if (!trips || trips.length === 0) {
        console.log('TripSheet: No trips found to display.'); // Log empty state
        container.innerHTML = '<p class="no-trips-message">No trips recorded yet.</p>';
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table header
    const headerRow = document.createElement('tr');
    const headers = ['Date', 'Start', 'End', 'Total', 'Customer', 'Purpose'];
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Create table body
    trips.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending

    trips.forEach(trip => {
        const row = document.createElement('tr');

        const totalKm = (trip.endKm && trip.startKm) ? (trip.endKm - trip.startKm) : 'N/A';
        const formattedDate = trip.date ? new Date(trip.date).toLocaleDateString() : 'N/A';

        const cells = [
            formattedDate,
            trip.startKm ?? 'N/A',
            trip.endKm ?? 'N/A',
            totalKm,
            trip.customer ?? 'N/A',
            trip.purpose ?? 'N/A'
        ];

        cells.forEach(cellData => {
            const td = document.createElement('td');
            td.textContent = cellData;
            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);
    console.log('TripSheet: Table rendered.'); // Log table rendering
}

function displayErrorMessage(message) {
    console.error('TripSheet: Displaying error message:', message); // Log error display
    const container = document.getElementById('tripsListContainer');
    container.innerHTML = `<p class="alert">${message}</p>`;
}

// --- Initial Load ---
// This function is now called after the delay in request.onsuccess
function loadAndDisplayTrips() {
    console.log('TripSheet: loadAndDisplayTrips called.'); // Log initial load
    getTrips((trips) => {
        displayTripsTable(trips);
    });
}

// Note: DB initialization happens first via request.onsuccess,
// which then calls loadAndDisplayTrips after a short delay. 