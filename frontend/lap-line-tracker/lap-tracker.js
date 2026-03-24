const socket = io()

// Lock screen elements
const lockScreen = document.getElementById("lock-screen")
const accessKeyInput = document.getElementById("access-key")
const unlockBtn = document.getElementById("unlock-btn")
const errorMessage = document.getElementById("error-message")

// Lap tracker panel elements
const lapTrackerPanel = document.getElementById("lap-tracker-panel")
const carButtons = document.querySelectorAll(".car-btn")
const statusMessage = document.getElementById("status-message")

// Wait for socket connection before enabling auth
let socketConnected = false

socket.on("connect", () => {
    console.log("Connected to server")
    socketConnected = true
    errorMessage.textContent = ""
})

socket.on("disconnect", () => {
    console.log("Disconnected from server")
    socketConnected = false
})

// Authentication
unlockBtn.addEventListener("click", () => {
    const accessKey = accessKeyInput.value.trim()
    
    if (!socketConnected) {
        errorMessage.textContent = "Connecting to server..."
        return
    }
    
    if (accessKey === "") {
        errorMessage.textContent = "Enter observer key"
        return
    }
    
    // Disable button while authenticating
    unlockBtn.disabled = true
    errorMessage.textContent = ""
    
    socket.emit("auth:observer", { accessKey }, (response) => {
        console.log("auth:observer response:", response)
        
        unlockBtn.disabled = false
        
        if (!response) {
            errorMessage.textContent = "No response from server"
            return
        }
        
        if (!response.success) {
            errorMessage.textContent = response.error || "Invalid access key"
            return
        }
        
        // Authentication successful - unlock interface
        lockScreen.hidden = true
        lapTrackerPanel.hidden = false
    })
})

// Allow Enter key to submit
accessKeyInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        unlockBtn.click()
    }
})

// Lap crossing buttons
carButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const carNumber = parseInt(btn.dataset.car)
        const timestamp = Date.now()
        
        // Visual feedback - pulse animation
        btn.classList.add("pulse")
        setTimeout(() => btn.classList.remove("pulse"), 300)
        
        // Emit lap crossing event
        socket.emit("lap:crossing", { carNumber, timestamp }, (response) => {
            console.log("lap:crossing response:", response)
            
            if (response.success) {
                // Show lap information
                const lapInfo = response.lap
                statusMessage.textContent = `Car ${carNumber}: Lap ${lapInfo.lapNumber} - ${formatTime(lapInfo.lapTime)} (Best: ${formatTime(lapInfo.bestTime)})`
                statusMessage.className = "success"
                
                // Clear message after 3 seconds
                setTimeout(() => {
                    statusMessage.textContent = ""
                    statusMessage.className = ""
                }, 3000)
            } else {
                statusMessage.textContent = response.error || "Failed to record lap"
                statusMessage.className = "error"
            }
        })
    })
})

// Format time in milliseconds to seconds with 2 decimals
function formatTime(ms) {
    if (ms === null || ms === undefined) return "—"
    return (ms / 1000).toFixed(2) + "s"
}
