document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('backBtn');
    const remindersListContainer = document.getElementById('reminders-list');

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    } else {
        console.error('Back button not found');
    }

    // --- Database Setup ---
    let db;
    const request = indexedDB.open('TripTrackerDB', 4); // Use the correct DB version

    request.onerror = (event) => {
        console.error('Database error:', event.target.error);
        if (remindersListContainer) {
            remindersListContainer.innerHTML = '<p style="color: red;">Error loading database. Cannot display reminders.</p>';
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Database opened successfully for schedule page.');
        if (!db.objectStoreNames.contains('reminders')) {
             console.error("Error: 'reminders' object store not found.");
             if (remindersListContainer) {
                 remindersListContainer.innerHTML = '<p style="color: red;">Error: Reminder data store not found.</p>';
             }
             return;
        }
        // Fetch and display reminders once DB is ready
        loadAndDisplayReminders();
    };

    // --- Function to fetch reminders from IndexedDB ---
    function getRemindersFromDB(callback) {
        if (!db) {
            console.error('DB not available to fetch reminders');
            callback([]);
            return;
        }
        const transaction = db.transaction(['reminders'], 'readonly');
        const store = transaction.objectStore('reminders');
        const request = store.getAll();

        request.onsuccess = () => {
            const reminders = request.result || [];
            console.log('Fetched reminders from DB:', reminders);
            // Sort reminders by date (YYYY-MM-DD string comparison works)
            reminders.sort((a, b) => (a.reminderDate || '').localeCompare(b.reminderDate || ''));
            callback(reminders);
        };

        request.onerror = (event) => {
            console.error('Error fetching reminders from DB:', event.target.error);
            callback([]);
        };
    }

    // --- Function to display reminders as a list ---
    function displayRemindersList(reminders) {
        if (!remindersListContainer) {
            console.error('Reminders list container not found');
            return;
        }

        if (!reminders || reminders.length === 0) {
            remindersListContainer.innerHTML = '<p>No work reminders found.</p>';
            return;
        }

        let htmlContent = '';
        reminders.forEach(reminder => {
            let displayDate = reminder.reminderDate;
            try {
                const dateObj = new Date(reminder.reminderDate + 'T00:00:00');
                if (!isNaN(dateObj)) {
                    displayDate = dateObj.toLocaleDateString(undefined, {
                        year: 'numeric', month: 'long', day: 'numeric'
                    });
                }
            } catch (e) { /* Ignore date formatting errors, use original */ }

            htmlContent += `
                <div class="reminder-item" data-id="${reminder.id}">
                    <div class="reminder-date">${displayDate || 'No Date'}</div>
                    <div class="reminder-details">
                        <strong>Type:</strong> ${reminder.type || 'N/A'}<br>
                        <strong>Customer:</strong> ${reminder.customer || 'N/A'}<br>
                        <strong>Purpose:</strong> ${reminder.purpose || 'N/A'}
                    </div>
                    <button class="btn btn-set-active" data-id="${reminder.id}">Set as Active</button>
                </div>
            `;
        });

        remindersListContainer.innerHTML = htmlContent;

        // Add event listeners for the "Set as Active" buttons
        const setActiveButtons = document.querySelectorAll('.btn-set-active');
        setActiveButtons.forEach(button => {
            button.addEventListener('click', () => {
                const reminderId = button.getAttribute('data-id');
                setReminderAsActive(reminderId);
            });
        });
    }

    // --- Load and Display ---
    function loadAndDisplayReminders() {
        getRemindersFromDB((reminders) => {
            displayRemindersList(reminders);
        });
    }

    // Note: loadAndDisplayReminders is called from request.onsuccess
}); 