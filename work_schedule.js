document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('backBtn');
    const remindersListContainer = document.getElementById('reminders-list');
    // --- NEW: Get references to the custom modal elements ---
    const activityInProgressModal = document.getElementById('activityInProgressModal');
    const closeActivityModalBtn = document.getElementById('closeActivityModalBtn');
    const okActivityModalBtn = document.getElementById('okActivityModalBtn');
    // --- End NEW ---

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    } else {
        console.error('Back button not found');
    }

    // --- Database Setup ---
    let db;
    const request = indexedDB.open('TripTrackerDB', 4);

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

        console.log('Displaying reminders:', reminders);

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
                    <div class="reminder-actions">
                        <button class="btn btn-set-active" data-id="${reminder.id}">Set as Active</button>
                        <button class="btn btn-delete-reminder" data-id="${reminder.id}">Delete Reminder</button>
                    </div>
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

        // Add event listeners for the "Delete Reminder" buttons
        const deleteButtons = document.querySelectorAll('.btn-delete-reminder');
        deleteButtons.forEach(button => {
            button.addEventListener('click', () => {
                const reminderId = button.getAttribute('data-id');
                deleteReminder(reminderId);
            });
        });
    }

    // --- Load and Display ---
    function loadAndDisplayReminders() {
        getRemindersFromDB((reminders) => {
            displayRemindersList(reminders);
        });
    }

    // Function to delete a reminder
    function deleteReminder(reminderId) {
        if (!db) {
            console.error('DB not available to delete reminder');
            return;
        }

        // Convert reminderId to a number
        const numericReminderId = Number(reminderId);
        if (isNaN(numericReminderId)) {
            console.error('Invalid reminder ID:', reminderId);
            return;
        }

        console.log(`Attempting to delete reminder with numeric ID: ${numericReminderId}`); // Add log

        const transaction = db.transaction(['reminders'], 'readwrite');
        const store = transaction.objectStore('reminders');
        const request = store.delete(numericReminderId); // Use the numeric ID

        request.onsuccess = () => {
            console.log(`Delete request successful for ID: ${numericReminderId}`);
            // The list refresh should happen when the transaction completes
        };

        request.onerror = (event) => {
            console.error(`Error deleting reminder with ID ${numericReminderId}:`, event.target.error);
        };

        // Refresh the list only after the transaction completes successfully
        transaction.oncomplete = () => {
            console.log(`Transaction completed for deleting ID: ${numericReminderId}. Refreshing list.`);
            loadAndDisplayReminders(); // Refresh the list here
        };

        transaction.onerror = (event) => {
            console.error('Transaction error during delete:', event.target.error);
            // Optionally, still try to refresh the list or show an error
            // loadAndDisplayReminders();
        };
    }

    // Define the ACTIVE_ACTIVITY_KEY constant
    const ACTIVE_ACTIVITY_KEY = 'activeActivityData';

    // --- NEW: Functions to control the custom modal ---
    function openActivityInProgressModal() {
        if (activityInProgressModal) {
            activityInProgressModal.style.display = 'block';
        }
    }

    function closeActivityInProgressModal() {
        if (activityInProgressModal) {
            activityInProgressModal.style.display = 'none';
        }
    }
    // --- End NEW ---

    function setReminderAsActive(reminderId) {
        if (!db) {
            console.error('DB not available to fetch reminder');
            return;
        }

        // Check if there is already an active activity
        const storedActivity = localStorage.getItem(ACTIVE_ACTIVITY_KEY);
        if (storedActivity) {
            // --- MODIFIED: Show custom modal instead of alert ---
            openActivityInProgressModal();
            // alert('An activity (Travel or Office Work) is already in progress. Please complete it first.');
            // --- End MODIFIED ---
            return; // Exit the function if there is an active activity
        }

        const transaction = db.transaction(['reminders'], 'readwrite');
        const store = transaction.objectStore('reminders');
        const request = store.get(Number(reminderId));

        request.onsuccess = () => {
            const reminder = request.result;
            if (!reminder) {
                alert('Reminder not found.');
                return;
            }

            // Normalize the type to 'travel' or 'office'
            const normalizedType = reminder.type === 'trip' ? 'travel' : reminder.type;

            // Set the reminder as the active task
            const activeTask = {
                type: normalizedType, // Use the normalized type
                customer: reminder.customer,
                purpose: reminder.purpose,
                startTime: new Date().toISOString(),
                status: 'active',
                reminderId: reminder.id // Optional: Track the reminder ID
            };

            activeActivityData = activeTask;
            try {
                localStorage.setItem(ACTIVE_ACTIVITY_KEY, JSON.stringify(activeActivityData));
                console.log('Reminder set as active:', activeTask);

                // Remove the reminder from the reminders list
                const deleteRequest = store.delete(reminder.id);
                deleteRequest.onsuccess = () => {
                    console.log('Reminder removed from the reminders list.');
                    loadAndDisplayReminders(); // Refresh the reminders list
                };
                deleteRequest.onerror = (event) => {
                    console.error('Error deleting reminder:', event.target.error);
                };

                // Redirect to index.html to display the active task
                window.location.href = 'index.html';
            } catch (e) {
                console.error('Error setting reminder as active:', e);
                alert('Failed to set task as active. Please try again.');
            }
        };

        request.onerror = (event) => {
            console.error('Error fetching reminder:', event.target.error);
            alert('Failed to fetch reminder. Please try again.');
        };
    }

    // --- NEW: Add event listeners for the custom modal ---
    if (closeActivityModalBtn) {
        closeActivityModalBtn.addEventListener('click', closeActivityInProgressModal);
    }
    if (okActivityModalBtn) {
        okActivityModalBtn.addEventListener('click', closeActivityInProgressModal);
    }
    // Optional: Close modal if clicking outside the content area
    window.addEventListener('click', (event) => {
        if (event.target === activityInProgressModal) {
            closeActivityInProgressModal();
        }
    });
    // --- End NEW ---

    // Initial load
    // ... (request.onsuccess calls loadAndDisplayReminders) ...
}); 