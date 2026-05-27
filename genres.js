// genres.js

let genreData = {};
let genreChart = null;

const startYear = 1500;
const endYear = 1800;
const yearsRange = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

// 17 Level 1 Genre Categories
const genreCategories = [
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

// Color palette (harmonized HSL colors)
const colors = [
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

// DOM elements
const citySelector = document.getElementById("city-selector");
const smoothingSlider = document.getElementById("smoothing-slider");
const smoothingVal = document.getElementById("smoothing-val");
const genreChecklist = document.getElementById("genre-checklist");
const chartCityTitle = document.getElementById("chart-city-title");

const btnSelectAll = document.getElementById("btn-select-all");
const btnDeselectAll = document.getElementById("btn-deselect-all");

// Initial Setup
window.addEventListener("DOMContentLoaded", async () => {
    await loadGenreData();
    setupChecklist();
    updateChart();
    
    // Listeners
    citySelector.addEventListener("change", (e) => {
        const selectedText = citySelector.options[citySelector.selectedIndex].text;
        chartCityTitle.innerText = `${selectedText}: Print Genres`;
        updateChart();
    });
    
    smoothingSlider.addEventListener("input", (e) => {
        smoothingVal.innerText = `${e.target.value} years`;
        updateChart();
    });
    
    btnSelectAll.addEventListener("click", () => {
        genreChecklist.querySelectorAll("input").forEach(cb => cb.checked = true);
        updateChart();
    });
    
    btnDeselectAll.addEventListener("click", () => {
        genreChecklist.querySelectorAll("input").forEach(cb => cb.checked = false);
        updateChart();
    });
});

// Load the precomputed data JSON
async function loadGenreData() {
    try {
        const res = await fetch("./data/work/genre_data.json");
        genreData = await res.json();
    } catch (err) {
        console.error("Failed to load precomputed genre data:", err);
    }
}

// Populate genres checklist in sidebar
function setupChecklist() {
    // Default checked categories (e.g. major categories for initial view)
    const defaultChecked = [
        "Theology & Religious Polemic",
        "Literature",
        "Law & Government",
        "Education & Academic Publications"
    ];
    
    genreChecklist.innerHTML = "";
    genreCategories.forEach((genre, idx) => {
        const label = document.createElement("label");
        label.className = "genre-item";
        
        const isChecked = defaultChecked.includes(genre) ? "checked" : "";
        label.innerHTML = `
            <input type="checkbox" value="${genre}" ${isChecked}>
            <span style="color: ${colors[idx % colors.length]}; font-weight: bold; margin-right: 4px;">●</span>
            <span>${genre}</span>
        `;
        
        label.querySelector("input").addEventListener("change", updateChart);
        genreChecklist.appendChild(label);
    });
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

// Refresh and draw Chart.js
function updateChart() {
    const cityId = citySelector.value;
    const smoothingWindow = parseInt(smoothingSlider.value);
    
    const checkedBoxes = Array.from(genreChecklist.querySelectorAll("input:checked"));
    const selectedGenres = checkedBoxes.map(cb => cb.value);
    
    const cityData = genreData[cityId] || {};
    const datasets = [];
    
    selectedGenres.forEach(genre => {
        const genreYears = cityData[genre] || {};
        const rawValues = [];
        
        // Map every year from 1500 to 1800 to its count or 0 if missing
        yearsRange.forEach(yr => {
            rawValues.push(genreYears[yr] || 0);
        });
        
        // Apply moving average smoothing
        const smoothedValues = smooth(rawValues, smoothingWindow);
        
        const colorIdx = genreCategories.indexOf(genre);
        const color = colors[colorIdx % colors.length];
        
        datasets.push({
            label: genre,
            data: smoothedValues,
            borderColor: color,
            backgroundColor: "transparent",
            borderWidth: 2.2,
            pointRadius: 0, // Hide points for clean smooth lines
            tension: 0.1,
            spanGaps: true
        });
    });
    
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
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true
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
