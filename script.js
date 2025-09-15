// A single object to hold and manage all application data.
const appData = {
    people: JSON.parse(localStorage.getItem('fairTurnPeople')) || [],
    tasks: JSON.parse(localStorage.getItem('fairTurnTasks')) || [],
    history: JSON.parse(localStorage.getItem('fairTurnHistory')) || [],
    assignments: JSON.parse(localStorage.getItem('fairTurnAssignments')) || [],
    lastAssignmentDate: localStorage.getItem('fairTurnLastAssignmentDate') || null,
    skippedPeople: JSON.parse(localStorage.getItem('fairTurnSkippedPeople')) || [] // New: stores temporarily skipped people
};

// Function to save all data to localStorage.
function saveData() {
    localStorage.setItem('fairTurnPeople', JSON.stringify(appData.people));
    localStorage.setItem('fairTurnTasks', JSON.stringify(appData.tasks));
    localStorage.setItem('fairTurnHistory', JSON.stringify(appData.history));
    localStorage.setItem('fairTurnAssignments', JSON.stringify(appData.assignments));
    localStorage.setItem('fairTurnLastAssignmentDate', appData.lastAssignmentDate);
    localStorage.setItem('fairTurnSkippedPeople', JSON.stringify(appData.skippedPeople));
}

// Function to find the next person in the rotation based on the last completed task.
function getNextPersonInRotation(activePeople) {
    if (activePeople.length === 0) return null;

    // If no history, or if everyone has been skipped, start with the first active person.
    if (appData.history.length === 0 || activePeople.every(p => !appData.history.some(h => h.person === p))) {
        return activePeople[0];
    }

    // Find the last person who completed ANY task
    const lastEntry = appData.history.length > 0 ? appData.history[appData.history.length - 1] : null;
    let lastPerson = lastEntry ? lastEntry.person : null;

    // If the last person is skipped, or not in active people, find the next active person after them.
    let lastPersonIndex = activePeople.indexOf(lastPerson);
    if (lastPersonIndex === -1) { // If last person isn't currently active, find next from start
         lastPersonIndex = activePeople.length - 1; // Effectively start from beginning + 1
    }
    
    const nextIndex = (lastPersonIndex + 1) % activePeople.length;
    return activePeople[nextIndex];
}

// Function to assign daily and custom frequency tasks fairly.
function assignTasksFairly() {
    const activePeople = appData.people.filter(person => !appData.skippedPeople.includes(person));

    if (activePeople.length === 0 || appData.tasks.length === 0) {
        return [];
    }
    
    const assignments = [];
    const today = new Date();
    
    // Determine the starting person for today's rotation.
    let currentPersonIndex = activePeople.indexOf(getNextPersonInRotation(activePeople));
    if (currentPersonIndex === -1) { // Fallback if getNextPersonInRotation returns someone not in activePeople
        currentPersonIndex = 0;
    }

    // Sort tasks for consistent assignment order.
    appData.tasks.sort((a, b) => a.name.localeCompare(b.name));

    appData.tasks.forEach(task => {
        let lastCompletionDate = null;
        for (let i = appData.history.length - 1; i >= 0; i--) {
            if (appData.history[i].task === task.name) {
                lastCompletionDate = new Date(appData.history[i].date);
                break;
            }
        }

        const daysSinceLastCompletion = lastCompletionDate ? (today.getTime() - lastCompletionDate.getTime()) / (1000 * 3600 * 24) : Infinity;

        // Assign task if its frequency is met.
        if (daysSinceLastCompletion >= task.frequency) {
            const person = activePeople[currentPersonIndex];
            assignments.push({ task: task.name, person: person });
            currentPersonIndex = (currentPersonIndex + 1) % activePeople.length;
        }
    });

    return assignments;
}

// Function to display the lists of people and all tasks.
function displayManagedLists() {
    const peopleList = document.getElementById('people-list');
    const allTasksList = document.getElementById('all-tasks-list');
    peopleList.innerHTML = '';
    allTasksList.innerHTML = '';

    appData.people.forEach(person => {
        const li = document.createElement('li');
        const isSkipped = appData.skippedPeople.includes(person);
        li.innerHTML = `
            <span>${person}</span>
            <div>
                <button class="skip-btn ${isSkipped ? 'skipped' : ''}" data-person="${person}" title="${isSkipped ? 'Unskip' : 'Skip'} this person">
                    <i class="fas ${isSkipped ? 'fa-user-check' : 'fa-user-slash'}"></i>
                </button>
                <button class="delete-btn" data-person="${person}" title="Remove person"><i class="fas fa-times-circle"></i></button>
            </div>
        `;
        peopleList.appendChild(li);
    });

    appData.tasks.forEach(task => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${task.name} (${task.frequency} days)</span>
            <button class="delete-btn" data-task="${task.name}" title="Remove task"><i class="fas fa-times-circle"></i></button>
        `;
        allTasksList.appendChild(li);
    });
}

// Function to display today's assignments.
function displayAssignments() {
    const assignmentsList = document.getElementById('assignments-list');
    assignmentsList.innerHTML = '';

    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Check for new day and regenerate tasks if needed.
    const todayDateString = new Date().toDateString();
    if (appData.lastAssignmentDate !== todayDateString || appData.assignments.length === 0) {
        // Clear skipped people from previous day
        if (appData.lastAssignmentDate !== todayDateString) {
            appData.skippedPeople = [];
        }
        appData.assignments = assignTasksFairly();
        appData.lastAssignmentDate = todayDateString;
        saveData();
    }
    
    // Display the saved assignments.
    if (appData.assignments.length === 0) {
        assignmentsList.innerHTML = '<p class="no-tasks-message">No tasks assigned for today. Add people and tasks, or regenerate!</p>';
        return;
    }

    appData.assignments.forEach(assignment => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        taskItem.innerHTML = `
            <span class="task-info">
                <strong>${assignment.task}</strong> 
                <span>Assigned to: ${assignment.person}</span>
            </span>
            <button class="colorful-btn success-btn done-btn" data-task="${assignment.task}" data-person="${assignment.person}">Done <i class="fas fa-check-circle"></i></button>
        `;
        assignmentsList.appendChild(taskItem);
    });
}

// Function to display task history.
function displayHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    // Sort history by date descending and take the latest 10.
    const sortedHistory = [...appData.history].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sortedHistory.length === 0) {
        historyList.innerHTML = '<p class="no-tasks-message">No task history yet.</p>';
        return;
    }

    sortedHistory.slice(0, 10).forEach(entry => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${entry.task} by <strong>${entry.person}</strong> on ${new Date(entry.date).toLocaleDateString()}</span>
        `;
        historyList.appendChild(li);
    });
}

// --- Event Listeners ---

// Toggle custom frequency input
document.getElementById('task-frequency').addEventListener('change', (event) => {
    const customInput = document.getElementById('custom-frequency-input');
    if (event.target.value === 'custom') {
        customInput.style.display = 'block';
        customInput.setAttribute('required', 'true');
    } else {
        customInput.style.display = 'none';
        customInput.removeAttribute('required');
    }
});

// Add new person
document.getElementById('add-person-btn').addEventListener('click', () => {
    const personInput = document.getElementById('person-input');
    const name = personInput.value.trim();
    if (name && !appData.people.includes(name)) {
        appData.people.push(name);
        saveData();
        displayManagedLists();
        personInput.value = '';
        // Force regeneration of assignments to include/consider new person
        appData.lastAssignmentDate = null; 
        displayAssignments();
    } else if (name) {
        alert('This person already exists!');
    }
});

// Add new task
document.getElementById('add-task-btn').addEventListener('click', () => {
    const taskInput = document.getElementById('task-input');
    const freqSelect = document.getElementById('task-frequency');
    const customFreqInput = document.getElementById('custom-frequency-input');

    const name = taskInput.value.trim();
    let frequency;

    if (freqSelect.value === 'custom') {
        frequency = parseInt(customFreqInput.value, 10);
        if (isNaN(frequency) || frequency < 1) {
            alert('Please enter a valid number of days for custom frequency.');
            return;
        }
    } else {
        frequency = parseInt(freqSelect.value, 10);
    }

    if (name) {
        appData.tasks.push({ name, frequency });
        saveData();
        displayManagedLists();
        taskInput.value = '';
        customFreqInput.value = '';
        freqSelect.value = '1'; // Reset frequency to Daily
        customFreqInput.style.display = 'none'; // Hide custom input
        // Force regeneration of assignments to include/consider new task
        appData.lastAssignmentDate = null;
        displayAssignments();
    } else {
        alert('Please enter a task name.');
    }
});

// Handle "Done" button clicks for assignments
document.getElementById('assignments-list').addEventListener('click', (event) => {
    if (event.target.closest('.done-btn')) {
        const btn = event.target.closest('.done-btn');
        const taskName = btn.dataset.task;
        const personName = btn.dataset.person;

        if (personName === 'No one assigned' || !personName) {
            alert("This task has no one assigned. Please add people first!");
            return;
        }
        
        appData.history.push({
            task: taskName,
            person: personName,
            date: new Date().toISOString()
        });
        saveData();
        
        // Remove the task from the current assignments list in the UI
        btn.closest('.task-item').remove();
        
        // After marking done, re-evaluate and display history
        displayHistory();
        // The assignment list will automatically re-render if it's a new day,
        // otherwise, it remains as is until regenerate.
    }
});

// Handle "Skip" and "Delete" buttons in the managed lists
document.getElementById('people-list').addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;

    const personName = target.dataset.person;

    if (target.classList.contains('skip-btn')) {
        if (appData.skippedPeople.includes(personName)) {
            // Unskip
            appData.skippedPeople = appData.skippedPeople.filter(p => p !== personName);
        } else {
            // Skip
            appData.skippedPeople.push(personName);
        }
        saveData();
        displayManagedLists();
        // Force regeneration of assignments to reflect skip
        appData.lastAssignmentDate = null;
        displayAssignments();
    } else if (target.classList.contains('delete-btn')) {
        if (confirm(`Are you sure you want to remove ${personName}? All history related to them will remain.`)) {
            appData.people = appData.people.filter(p => p !== personName);
            appData.skippedPeople = appData.skippedPeople.filter(p => p !== personName); // Also remove from skipped
            saveData();
            displayManagedLists();
            appData.lastAssignmentDate = null; // Re-evaluate assignments
            displayAssignments();
        }
    }
});

document.getElementById('all-tasks-list').addEventListener('click', (event) => {
    const target = event.target.closest('.delete-btn');
    if (!target) return;

    const taskName = target.dataset.task;

    if (confirm(`Are you sure you want to remove the task "${taskName}"? All history related to it will remain.`)) {
        appData.tasks = appData.tasks.filter(t => t.name !== taskName);
        saveData();
        displayManagedLists();
        appData.lastAssignmentDate = null; // Re-evaluate assignments
        displayAssignments();
    }
});

// Regenerate assignments button
document.getElementById('regenerate-btn').addEventListener('click', () => {
    appData.assignments = assignTasksFairly();
    appData.lastAssignmentDate = new Date().toDateString(); // Update date to mark as freshly generated
    saveData();
    displayAssignments();
});

// Initial function calls to set up the page.
function init() {
    displayManagedLists();
    displayAssignments();
    displayHistory();
}

// Run the initialization function when the page loads.
document.addEventListener('DOMContentLoaded', init);