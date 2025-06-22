
// migrateTaskDataToArrayFormat();
// function migrateTaskDataToArrayFormat() {
//     const storedData = JSON.parse(localStorage.getItem("tasks")) || {};
//     const migratedData = {};

//     for (const date in storedData) {
//         migratedData[date] = {};

//         ["morning", "afternoon", "evening"].forEach(period => {
//             const value = storedData[date][period];

//             // If it's NOT an array already AND it has task/color keys
//             if (value && typeof value === "object" && !Array.isArray(value)) {
//                 const { task = "", color = "" } = value;
//                 migratedData[date][period] = [{ task, color }];
//             }

//             // If it's already in correct format (array of objects), keep as-is
//             else if (Array.isArray(value)) {
//                 migratedData[date][period] = value;
//             }

//             // If missing or invalid, default to empty array
//             else {
//                 migratedData[date][period] = [];
//             }
//         });
//     }

//     localStorage.setItem("tasks", JSON.stringify(migratedData));
//     console.log("✅ Task data migrated to array-of-objects format.");
// }


//revert here again
