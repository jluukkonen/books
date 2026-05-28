// genres.js

let genreData = {};
let genreChart = null;

const startYearLimit = 1500;
const endYearLimit = 1800;

// 17 Level 1 Genre Categories and their default colors
const level1Categories = [
    "Arts & Culture",
    "Economy & Commerce",
    "Education & Academic Publications",
    "Geography & Travel",
    "History & Biography",
    "Language & Rhetoric",
    "Law & Government",
    "Literature",
    "Medicine & Health",
    "Military",
    "Natural History & Agriculture",
    "Philosophy & Scholarly Treatises",
    "Print Forms & Ephemera",
    "Religious Literature",
    "Science & Mathematics",
    "Society Ethics & Practical Life",
    "Theology & Religious Polemic"
];

const level1Colors = [
    "hsl(217, 91%, 60%)",  // Arts & Culture
    "hsl(142, 70%, 45%)",  // Economy & Commerce
    "hsl(262, 80%, 65%)",  // Education & Academics
    "hsl(36, 100%, 55%)",  // Geography & Travel
    "hsl(340, 80%, 55%)",  // History & Biography
    "hsl(180, 75%, 40%)",  // Language & Rhetoric
    "hsl(12, 90%, 55%)",   // Law & Government
    "hsl(200, 95%, 45%)",  // Literature
    "hsl(285, 75%, 60%)",  // Medicine & Health
    "hsl(0, 85%, 60%)",    // Military
    "hsl(100, 70%, 40%)",  // Natural History
    "hsl(45, 90%, 50%)",   // Philosophy
    "hsl(24, 90%, 50%)",   // Print Forms
    "hsl(300, 70%, 60%)",  // Religious Lit
    "hsl(170, 80%, 40%)",  // Science & Math
    "hsl(80, 65%, 45%)",   // Society Ethics
    "hsl(330, 85%, 65%)"   // Theology & Polemic
];

const TOP20_CITIES = [
    "Frankfurt, Main", "Leipzig", "Augsburg", "Nürnberg", "Köln", 
    "Wittenberg", "Jena", "Straßburg", "Berlin", "Halle, Saale", 
    "Helmstedt", "Hamburg", "Dresden", "Rostock", "Wien", 
    "Tübingen", "Erfurt", "Basel", "Göttingen", "München"
];

const borderDashes = [
    [], // Solid (Frankfurt)
    [6, 4], // Dashed (Leipzig)
    [2, 3], // Dotted (Augsburg)
    [6, 3, 2, 3], // Dash-dot (Nürnberg)
    [12, 4], // Long dash
    [4, 1, 1, 1], // Fine dash-dot
    [8, 2, 2, 2, 2, 2] // Long-dash-multi-dot
];

// Color hash generator for Level 2 & 3
function getHashColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    const s = 65 + (Math.abs(hash) % 20); // 65%-85%
    const l = 45 + (Math.abs(hash) % 15); // 45%-60%
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function getCategoryColor(name, level) {
    if (level === 1) {
        const idx = level1Categories.indexOf(name);
        return idx !== -1 ? level1Colors[idx] : getHashColor(name);
    }
    return getHashColor(name);
}

// DOM Elements
const citySelectBtn = document.getElementById("city-select-btn");
const citySelectDropdown = document.getElementById("city-select-dropdown");
const cityCheckboxList = document.getElementById("city-checkbox-list");
const citySelectAll = document.getElementById("city-select-all");
const cityDeselectAll = document.getElementById("city-deselect-all");
const cityModeGroup = document.getElementById("city-mode-group");

const displayLevelRadios = document.querySelectorAll('input[name="display-level"]');
const startYearSlider = document.getElementById("start-year-slider");
const endYearSlider = document.getElementById("end-year-slider");
const startYearLbl = document.getElementById("start-year-lbl");
const endYearLbl = document.getElementById("end-year-lbl");
const timelineVal = document.getElementById("timeline-val");
const smoothingSlider = document.getElementById("smoothing-slider");
const smoothingVal = document.getElementById("smoothing-val");
const crisisToggle = document.getElementById("crisis-toggle");

const filterGenresBtn = document.getElementById("filter-genres-btn");
const filterDrawer = document.getElementById("filter-drawer");
const drawerCloseBtn = document.getElementById("drawer-close-btn");

const l1Checklist = document.getElementById("l1-checklist");
const l2Checklist = document.getElementById("l2-checklist");
const l3Checklist = document.getElementById("l3-checklist");

const l1Search = document.getElementById("l1-search");
const l2Search = document.getElementById("l2-search");
const l3Search = document.getElementById("l3-search");

const l1SelectAll = document.getElementById("l1-select-all");
const l1DeselectAll = document.getElementById("l1-deselect-all");
const l2SelectAll = document.getElementById("l2-select-all");
const l2DeselectAll = document.getElementById("l2-deselect-all");
const l3SelectAll = document.getElementById("l3-select-all");
const l3DeselectAll = document.getElementById("l3-deselect-all");

const chartCityTitle = document.getElementById("chart-city-title");

// Selection States
let checkedCities = ["all cities"]; // "all cities" is default combined
let checkedL1 = ["Theology & Religious Polemic", "Literature", "Law & Government", "Education & Academic Publications"];
let checkedL2 = [];
let checkedL3 = [];

// Initial Setup
window.addEventListener("DOMContentLoaded", async () => {
    await loadGenreData();
    setupCityDropdown();
    setupGenreDrawer();
    updateChart();
    
    // Global Click Listener to close city dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".custom-select-container")) {
            citySelectDropdown.classList.add("hidden");
        }
    });

    // Toggle city dropdown open
    citySelectBtn.addEventListener("click", (e) => {
        citySelectDropdown.classList.toggle("hidden");
    });

    // City Select All / Deselect All
    citySelectAll.addEventListener("click", () => {
        const checkboxes = cityCheckboxList.querySelectorAll("input");
        checkboxes.forEach(cb => {
            if (cb.value !== "all cities") cb.checked = true;
            else cb.checked = false;
        });
        updateCitySelectionState();
    });

    cityDeselectAll.addEventListener("click", () => {
        const checkboxes = cityCheckboxList.querySelectorAll("input");
        checkboxes.forEach(cb => {
            if (cb.value === "all cities") cb.checked = true;
            else cb.checked = false;
        });
        updateCitySelectionState();
    });

    // Display Level Change listener
    displayLevelRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            updateChart();
        });
    });

    // Timeline Slider listeners
    startYearSlider.addEventListener("input", (e) => {
        let val = parseInt(e.target.value);
        let endVal = parseInt(endYearSlider.value);
        if (val > endVal) {
            val = endVal;
            startYearSlider.value = val;
        }
        startYearLbl.innerText = val;
        timelineVal.innerText = `${val} - ${endVal}`;
        updateChart();
    });

    endYearSlider.addEventListener("input", (e) => {
        let val = parseInt(e.target.value);
        let startVal = parseInt(startYearSlider.value);
        if (val < startVal) {
            val = startVal;
            endYearSlider.value = val;
        }
        endYearLbl.innerText = val;
        timelineVal.innerText = `${startVal} - ${val}`;
        updateChart();
    });

    // Smoothing moving average slider
    smoothingSlider.addEventListener("input", (e) => {
        smoothingVal.innerText = `${e.target.value} years`;
        updateChart();
    });

    // Drawer Open / Close
    filterGenresBtn.addEventListener("click", () => {
        filterDrawer.classList.add("open");
    });

    drawerCloseBtn.addEventListener("click", () => {
        filterDrawer.classList.remove("open");
    });

    // Combined vs Separate city display mode radios
    document.querySelectorAll('input[name="city-mode"]').forEach(radio => {
        radio.addEventListener("change", () => {
            updateChart();
        });
    });

    // Crisis Overlay Toggle
    crisisToggle.addEventListener("change", () => {
        updateChart();
    });

    // Search filters
    l1Search.addEventListener("input", (e) => filterChecklist(l1Checklist, e.target.value));
    l2Search.addEventListener("input", (e) => filterChecklist(l2Checklist, e.target.value));
    l3Search.addEventListener("input", (e) => filterChecklist(l3Checklist, e.target.value));

    // Drawer column select/deselect buttons
    l1SelectAll.addEventListener("click", () => { toggleChecklistSection(l1Checklist, true); updateChart(); });
    l1DeselectAll.addEventListener("click", () => { toggleChecklistSection(l1Checklist, false); updateChart(); });
    l2SelectAll.addEventListener("click", () => { toggleChecklistSection(l2Checklist, true); updateChart(); });
    l2DeselectAll.addEventListener("click", () => { toggleChecklistSection(l2Checklist, false); updateChart(); });
    l3SelectAll.addEventListener("click", () => { toggleChecklistSection(l3Checklist, true); updateChart(); });
    l3DeselectAll.addEventListener("click", () => { toggleChecklistSection(l3Checklist, false); updateChart(); });
});

// Fetch raw index-compressed precomputed taxonomy + metrics JSON
async function loadGenreData() {
    try {
        const res = await fetch("./data/work/genre_data.json");
        genreData = await res.json();
    } catch (err) {
        console.error("Failed to load precomputed taxonomy and stats:", err);
    }
}

// Populate multi-city checklist dropdown in sidebar
function setupCityDropdown() {
    cityCheckboxList.innerHTML = "";
    
    // Add "All Cities Combined" option first
    const allItem = document.createElement("label");
    allItem.className = "dropdown-checkbox-item";
    allItem.innerHTML = `
        <input type="checkbox" value="all cities" checked>
        <span>All Cities Combined</span>
    `;
    allItem.querySelector("input").addEventListener("change", handleCityCheckboxChange);
    cityCheckboxList.appendChild(allItem);
    
    // Add remaining 20 HRE hubs
    TOP20_CITIES.forEach(city => {
        const item = document.createElement("label");
        item.className = "dropdown-checkbox-item";
        item.innerHTML = `
            <input type="checkbox" value="${city}">
            <span>${city}</span>
        `;
        item.querySelector("input").addEventListener("change", handleCityCheckboxChange);
        cityCheckboxList.appendChild(item);
    });
}

function handleCityCheckboxChange(e) {
    const val = e.target.value;
    const isChecked = e.target.checked;
    
    const checkboxes = cityCheckboxList.querySelectorAll("input");
    
    if (val === "all cities" && isChecked) {
        // If "All Cities" is checked, deselect all individual cities
        checkboxes.forEach(cb => {
            if (cb.value !== "all cities") cb.checked = false;
        });
    } else if (val !== "all cities" && isChecked) {
        // If an individual city is checked, deselect "All Cities Combined"
        checkboxes.forEach(cb => {
            if (cb.value === "all cities") cb.checked = false;
        });
    }
    
    // If absolutely nothing is checked, fallback to checking "All Cities Combined"
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    if (!anyChecked) {
        checkboxes.forEach(cb => {
            if (cb.value === "all cities") cb.checked = true;
        });
    }
    
    updateCitySelectionState();
}

function updateCitySelectionState() {
    const checked = Array.from(cityCheckboxList.querySelectorAll("input:checked")).map(cb => cb.value);
    checkedCities = checked;
    
    // Update button text
    if (checked.includes("all cities")) {
        citySelectBtn.innerText = "All Cities Combined";
        cityModeGroup.style.display = "none";
    } else {
        if (checked.length === 1) {
            citySelectBtn.innerText = checked[0];
            cityModeGroup.style.display = "none";
        } else {
            citySelectBtn.innerText = `${checked.length} Cities Selected`;
            cityModeGroup.style.display = "block"; // Show combined vs separate option
        }
    }
    
    // Update chart title
    let selectedText = citySelectBtn.innerText;
    chartCityTitle.innerText = `${selectedText}: Print Genres`;
    
    updateChart();
}

// Populate the taxonomy checklists inside the sliding drawer
function setupGenreDrawer() {
    const tax = genreData.taxonomy || {};
    
    // 1. Level 1 Categories
    l1Checklist.innerHTML = "";
    (tax.Level1 || []).forEach(name => {
        const item = createChecklistItem(name, 1, checkedL1.includes(name));
        l1Checklist.appendChild(item);
    });

    // 2. Level 2 Categories
    l2Checklist.innerHTML = "";
    (tax.Level2 || []).forEach(name => {
        const item = createChecklistItem(name, 2, checkedL2.includes(name));
        l2Checklist.appendChild(item);
    });

    // 3. Level 3 Categories
    l3Checklist.innerHTML = "";
    (tax.Level3 || []).forEach(name => {
        const item = createChecklistItem(name, 3, checkedL3.includes(name));
        l3Checklist.appendChild(item);
    });
}

function createChecklistItem(name, level, isChecked) {
    const item = document.createElement("label");
    item.className = "checklist-item";
    
    const colorCircle = level === 1 ? `<span style="color: ${getCategoryColor(name, 1)}; font-weight: bold; margin-right: 4px;">●</span>` : "";
    
    item.innerHTML = `
        <input type="checkbox" value="${name}" ${isChecked ? "checked" : ""}>
        ${colorCircle}
        <span>${name}</span>
    `;
    
    item.querySelector("input").addEventListener("change", (e) => {
        handleGenreCheckboxChange(name, level, e.target.checked);
    });
    
    return item;
}

// Handle cascading checking: L1 -> L2 -> L3
function handleGenreCheckboxChange(name, level, isChecked) {
    const tax = genreData.taxonomy || {};
    
    if (level === 1) {
        // Cascade check L1 -> L2 children
        const l2Children = tax.l1_to_l2[name] || [];
        const l2Checkboxes = l2Checklist.querySelectorAll("input");
        l2Checkboxes.forEach(cb => {
            if (l2Children.includes(cb.value)) {
                cb.checked = isChecked;
                // Also trigger L2 checkbox updates
                handleGenreCheckboxChange(cb.value, 2, isChecked);
            }
        });
    } else if (level === 2) {
        // Cascade check L2 -> L3 children
        const l3Children = tax.l2_to_l3[name] || [];
        const l3Checkboxes = l3Checklist.querySelectorAll("input");
        l3Checkboxes.forEach(cb => {
            if (l3Children.includes(cb.value)) {
                cb.checked = isChecked;
            }
        });
    }
    
    updateCheckedStates();
    updateChart();
}

function updateCheckedStates() {
    checkedL1 = Array.from(l1Checklist.querySelectorAll("input:checked")).map(cb => cb.value);
    checkedL2 = Array.from(l2Checklist.querySelectorAll("input:checked")).map(cb => cb.value);
    checkedL3 = Array.from(l3Checklist.querySelectorAll("input:checked")).map(cb => cb.value);
}

// Support searching/filtering terms inside checklists
function filterChecklist(checklistEl, query) {
    const items = checklistEl.querySelectorAll(".checklist-item");
    const q = query.toLowerCase().trim();
    items.forEach(item => {
        const text = item.querySelector("span:last-child").innerText.toLowerCase();
        if (!q || text.includes(q)) {
            item.style.display = "flex";
        } else {
            item.style.display = "none";
        }
    });
}

function toggleChecklistSection(checklistEl, checkAll) {
    const checkboxes = checklistEl.querySelectorAll("input");
    checkboxes.forEach(cb => {
        cb.checked = checkAll;
    });
    updateCheckedStates();
}

// Simple Moving Average smoothing function
function smooth(data, windowSize) {
    if (windowSize <= 1) return data;
    const half = Math.floor(windowSize / 2);
    const smoothed = [];
    
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        
        for (let w = -half; w <= half; w++) {
            const idx = i + w;
            if (idx >= 0 && idx < data.length) {
                sum += data[idx];
                count++;
            }
        }
        smoothed.push(count > 0 ? sum / count : 0);
    }
    
    return smoothed;
}

// Helper to parse index-compressed json arrays [year, count, year, count] into year-by-year counts
function parseCompressedList(arr) {
    const map = new Map();
    if (!arr) return map;
    for (let i = 0; i < arr.length; i += 2) {
        map.set(arr[i], arr[i+1]);
    }
    return map;
}

// Refresh and draw Chart.js
function updateChart() {
    if (!genreData.data) return;

    const displayLevel = parseInt(document.querySelector('input[name="display-level"]:checked').value);
    const startYear = parseInt(startYearSlider.value);
    const endYear = parseInt(endYearSlider.value);
    const smoothingWindow = parseInt(smoothingSlider.value);
    const cityMode = document.querySelector('input[name="city-mode"]:checked').value;
    
    const yearsRange = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
    const tax = genreData.taxonomy || {};
    
    // Choose active genres to plot based on display level and user selections
    let activeCategories = [];
    let levelKey = "";
    let lookupMap = [];
    
    if (displayLevel === 1) {
        levelKey = "Level1";
        lookupMap = tax.Level1;
        activeCategories = checkedL1;
    } else if (displayLevel === 2) {
        levelKey = "Level2";
        lookupMap = tax.Level2;
        // Fallback to plotting checked Level 2 or parent-linked items
        activeCategories = checkedL2;
    } else if (displayLevel === 3) {
        levelKey = "Level3";
        lookupMap = tax.Level3;
        activeCategories = checkedL3;
    } else {
        // Level 0 (Total publications)
        levelKey = "Level0";
        lookupMap = ["Total"];
        activeCategories = ["Total"];
    }

    const datasets = [];

    // Helper to generate year values for a specific city and category term
    function getSmoothedValues(city, catName) {
        const cityData = genreData.data[city] || {};
        const levelData = cityData[levelKey] || {};
        
        // Find index of category term
        const catIdx = lookupMap.indexOf(catName);
        const rawList = levelData[catIdx.toString()] || [];
        const yearMap = parseCompressedList(rawList);
        
        const rawValues = yearsRange.map(yr => yearMap.get(yr) || 0);
        return smooth(rawValues, smoothingWindow);
    }

    // 1. Single City or "All Cities Combined" Active OR Combined Mode Active
    if (checkedCities.length === 1 || cityMode === "combined") {
        activeCategories.forEach(cat => {
            const rawValuesAggregated = new Array(yearsRange.length).fill(0);
            
            // Sum counts across all checked cities
            checkedCities.forEach(city => {
                const values = getSmoothedValues(city, cat);
                for (let i = 0; i < yearsRange.length; i++) {
                    rawValuesAggregated[i] += values[i];
                }
            });
            
            const color = getCategoryColor(cat, displayLevel);
            
            datasets.push({
                label: cat,
                data: rawValuesAggregated,
                borderColor: color,
                backgroundColor: "transparent",
                borderWidth: 2.2,
                pointRadius: 0,
                tension: 0.1,
                spanGaps: true
            });
        });
    } 
    // 2. Separate Mode Active: Plot a line for each Checked Category-City combination
    else if (cityMode === "separate") {
        activeCategories.forEach(cat => {
            const color = getCategoryColor(cat, displayLevel);
            
            checkedCities.forEach((city, cityIdx) => {
                const values = getSmoothedValues(city, cat);
                
                // Cycle through dashes for different cities
                const dashPattern = borderDashes[cityIdx % borderDashes.length];
                
                datasets.push({
                    label: `${cat} — ${city}`,
                    data: values,
                    borderColor: color,
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    borderDash: dashPattern,
                    pointRadius: 0,
                    tension: 0.1,
                    spanGaps: true
                });
            });
        });
    }

    // Custom Crisis Drawing Plugin
    const showCrises = crisisToggle.checked;
    const crisisPlugin = {
        id: 'crisisOverlays',
        beforeDraw: (chart) => {
            if (!showCrises) return;
            const { ctx, chartArea: { top, bottom, left, right }, scales: { x } } = chart;
            ctx.save();
            
            const crises = [
                { start: 1618, end: 1648, label: "Thirty Years' War (1618-1648)", color: 'rgba(239, 68, 68, 0.07)', textColor: 'rgba(239, 68, 68, 0.6)' },
                { start: 1756, end: 1763, label: "Seven Years' War (1756-1763)", color: 'rgba(239, 68, 68, 0.07)', textColor: 'rgba(239, 68, 68, 0.6)' }
            ];
            
            crises.forEach(crisis => {
                const xStartVal = x.getPixelForValue(crisis.start);
                const xEndVal = x.getPixelForValue(crisis.end);
                
                const drawStart = Math.max(left, xStartVal);
                const drawEnd = Math.min(right, xEndVal);
                
                if (drawStart < drawEnd) {
                    // Draw shaded rectangle
                    ctx.fillStyle = crisis.color;
                    ctx.fillRect(drawStart, top, drawEnd - drawStart, bottom - top);
                    
                    // Draw border lines
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
                    ctx.lineWidth = 1.2;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    if (xStartVal >= left && xStartVal <= right) {
                        ctx.moveTo(xStartVal, top);
                        ctx.lineTo(xStartVal, bottom);
                    }
                    if (xEndVal >= left && xEndVal <= right) {
                        ctx.moveTo(xEndVal, top);
                        ctx.lineTo(xEndVal, bottom);
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    // Draw label text (only if there is enough space)
                    if (drawEnd - drawStart > 75) {
                        ctx.fillStyle = crisis.textColor;
                        ctx.font = 'italic 9.5px Inter, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(crisis.label, drawStart + (drawEnd - drawStart) / 2, top + 15);
                    }
                }
            });
            
            ctx.restore();
        }
    };

    // Render in canvas
    const ctx = document.getElementById("chart-genre-timeline").getContext("2d");
    
    if (genreChart) {
        genreChart.destroy();
    }
    
    genreChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: yearsRange,
            datasets: datasets
        },
        plugins: [crisisPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#94a3b8",
                        font: { family: "Inter", size: 10.5 },
                        padding: 12,
                        boxWidth: 12,
                        boxHeight: 8,
                        usePointStyle: false
                    }
                },
                tooltip: {
                    mode: "index",
                    intersect: false,
                    titleColor: "#f8fafc",
                    bodyColor: "#cbd5e1",
                    backgroundColor: "#1e293b",
                    borderColor: "rgba(255,255,255,0.08)",
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { color: "rgba(255, 255, 255, 0.04)" },
                    ticks: { color: "#64748b", font: { family: "Inter", size: 10 } }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.04)" },
                    ticks: { color: "#64748b", font: { family: "Inter", size: 10 } }
                }
            }
        }
    });
}
