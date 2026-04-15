# Feature Spec: Enhanced Patient Management & Vitals

## Overview

This feature expands Vera's patient data model and adds a dedicated patient management experience. Currently, patients are simple name/DOB/MRN records created during the new visit flow. After this feature, patients have rich profiles (physical descriptors, allergies, medications), visits capture vitals, and there's a full patient management section with a detail page that serves as a clinical home base for each patient.

## What Changes

### 1. Expanded Patient Profile

Add the following fields to the `Patient` model:

```prisma
model Patient {
  // existing fields
  id          String    @id @default(uuid())
  fullName    String
  dateOfBirth DateTime?
  mrn         String?   @unique
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // NEW fields
  sex         String?                    // "Male", "Female", "Other"
  heightCm    Float?                     // Height in centimeters
  eyeColor    String?
  bloodType   String?                    // e.g., "A+", "O-", "AB+"

  // existing relations
  sessions    Session[]

  // NEW relations
  allergies   Allergy[]
  medications Medication[]
}
```

### 2. New Models: Allergy & Medication

```prisma
model Allergy {
  id         String   @id @default(uuid())
  patientId  String
  name       String                     // e.g., "Penicillin", "Peanuts"
  severity   String?                    // "Mild", "Moderate", "Severe"
  reaction   String?                    // e.g., "Hives", "Anaphylaxis"
  createdAt  DateTime @default(now())

  patient    Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)
}

model Medication {
  id         String   @id @default(uuid())
  patientId  String
  name       String                     // e.g., "Lisinopril"
  dosage     String?                    // e.g., "10mg"
  frequency  String?                    // e.g., "Once daily", "Twice daily"
  createdAt  DateTime @default(now())

  patient    Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)
}
```

Both use `onDelete: Cascade` so deleting a patient cleans up their allergies and medications.

### 3. New Model: Vitals (per visit)

Vitals are captured manually by the physician at the start of each visit. They belong to the Session, not the Patient, because they're point-in-time measurements.

```prisma
model Vitals {
  id                String   @id @default(uuid())
  sessionId         String   @unique
  weightKg          Float?                  // Weight in kilograms
  bloodPressureSys  Int?                    // Systolic (mmHg)
  bloodPressureDia  Int?                    // Diastolic (mmHg)
  heartRate         Int?                    // Beats per minute
  temperatureC      Float?                  // Temperature in Celsius
  respiratoryRate   Int?                    // Breaths per minute
  oxygenSaturation  Float?                  // SpO2 percentage (e.g., 98.5)
  recordedAt        DateTime @default(now())

  session           Session  @relation(fields: [sessionId], references: [id])
}
```

Add the `vitals` relation to the existing Session model:

```prisma
model Session {
  // ... existing fields and relations ...
  vitals       Vitals?        // ADD this line
}
```

### 4. New API Endpoints

#### Patient Allergies

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/patients/:id/allergies` | Add an allergy (name required, severity and reaction optional) |
| `DELETE` | `/api/patients/:id/allergies/:allergyId` | Remove an allergy |

#### Patient Medications

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/patients/:id/medications` | Add a medication (name required, dosage and frequency optional) |
| `PUT` | `/api/patients/:id/medications/:medicationId` | Update a medication (e.g., dosage change) |
| `DELETE` | `/api/patients/:id/medications/:medicationId` | Remove a medication |

#### Vitals

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/sessions/:id/vitals` | Record vitals for a session. Creates a `VITALS_RECORDED` audit event. |
| `PUT` | `/api/sessions/:id/vitals` | Update vitals for a session |

#### Modified Existing Endpoints

| Endpoint | Change |
|---|---|
| `POST /api/patients` | Now accepts all new profile fields (sex, heightCm, eyeColor, bloodType) |
| `PUT /api/patients/:id` | Now accepts all new profile fields |
| `GET /api/patients` | Include allergy count and medication count per patient in list response |
| `GET /api/patients/:id` | Include full allergies, medications, and sessions (each session includes physician name, status, date) |
| `GET /api/sessions/:id` | Include vitals and physician in the session detail response |
| `GET /api/sessions` | Include physician name in each session in the list response |

### 5. New Frontend Routes

| Route | Page | Description |
|---|---|---|
| `/patients` | Patient List | Searchable list of all patients with summary info |
| `/patients/:id` | Patient Detail | Two-column layout: scrollable visit history on left, sticky patient profile on right |

Add "Patients" to the sidebar navigation (between Dashboard and Past Visits).

### 6. Patient List Page (`/patients`)

A searchable list of all patients.

Each `PatientCard` displays: full name, MRN, date of birth, number of visits, number of active allergies. Search bar filters by name or MRN as the user types. "Add New Patient" button opens an inline form or modal. Clicking a card navigates to `/patients/:id`.

### 7. Patient Detail Page (`/patients/:id`)

Two-column side-by-side layout. The visit history scrolls on the left while the patient profile stays sticky on the right — opposite the app sidebar, keeping the layout balanced.

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────┐  ┌──────────────────┐ │
│  │  Visit History                    │  │  Patient Profile  │ │
│  │  (SCROLLABLE)                     │  │  (STICKY)         │ │
│  │                                   │  │                   │ │
│  │  [Start New Visit]                │  │  Sarah Johnson    │ │
│  │                                   │  │  DOB: 03/15/1985 │ │
│  │  ┌─────────────────────────────┐  │  │  MRN: MRN-001    │ │
│  │  │ Feb 26, 2026                │  │  │  Sex: Female      │ │
│  │  │ Dr. Sarah Smith             │  │  │  Height: 165 cm   │ │
│  │  │ ● Approved                  │  │  │  Eye Color: Brown │ │
│  │  │ SOAP note: ✓                │  │  │  Blood Type: A+   │ │
│  │  └─────────────────────────────┘  │  │                   │ │
│  │                                   │  │  ── Allergies ──  │ │
│  │  ┌─────────────────────────────┐  │  │  🔴 Penicillin   │ │
│  │  │ Jan 10, 2026                │  │  │     Severe        │ │
│  │  │ Dr. James Lee               │  │  │  🟡 Latex        │ │
│  │  │ ● Completed                 │  │  │     Moderate      │ │
│  │  └─────────────────────────────┘  │  │  [+ Add Allergy] │ │
│  │                                   │  │                   │ │
│  │  ┌─────────────────────────────┐  │  │  ── Medications ──│ │
│  │  │ Dec 03, 2025                │  │  │  Lisinopril 10mg │ │
│  │  │ Dr. Sarah Smith             │  │  │    Once daily     │ │
│  │  │ ● Approved                  │  │  │  Metformin 500mg │ │
│  │  └─────────────────────────────┘  │  │    Twice daily    │ │
│  │                                   │  │  [+ Add Med]     │ │
│  └───────────────────────────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Left column — Visit History (scrollable):**
- `PatientVisitHistory` component: chronological list of sessions
- Each visit entry shows: date, **physician name**, status badge, whether a SOAP note exists and its status
- Clicking a visit navigates to `/visits/:id`
- "Start New Visit" button at the top creates a session for this patient and navigates to the active visit page

**Right column — Patient Profile (sticky):**
- `PatientProfile` component: displays all profile fields with inline edit capability
- `AllergyList` component: allergy tags/chips with severity color coding (red = severe, yellow = moderate, green = mild). Inline "Add Allergy" form with name, severity dropdown, reaction text. Delete button per allergy.
- `MedicationList` component: compact list with name, dosage, frequency. Inline "Add Medication" form. Edit and delete buttons per medication.

### 8. Vitals on Active Visit Page

Add a vitals section to the Active Visit page, positioned between the patient header and the audio recorder.

- `VitalsForm` component: compact grid layout with labeled number inputs for each vital sign (weight in kg, BP systolic/diastolic in mmHg, heart rate in bpm, temperature in °C, respiratory rate in breaths/min, SpO2 in %). "Save Vitals" button.
- `VitalsDisplay` component: read-only vitals summary in a clean grid. Highlight values outside normal ranges in yellow/red (e.g., HR > 100, temp > 38°C, SpO2 < 95%).
- Flow: VitalsForm shown initially. After saving, switches to VitalsDisplay with an "Edit" button. If vitals already exist for the session, show VitalsDisplay on load.

### 9. New Frontend Components

```
src/components/
├── patient/
│   ├── PatientCard.tsx          # Summary card for patient list
│   ├── PatientProfile.tsx       # Editable profile (demographics + descriptors)
│   ├── AllergyList.tsx          # Display + add/remove allergies
│   ├── MedicationList.tsx       # Display + add/update/remove medications
│   └── PatientVisitHistory.tsx  # Visit list with physician names
├── vitals/
│   ├── VitalsForm.tsx           # Manual entry form
│   └── VitalsDisplay.tsx        # Read-only display with abnormal highlighting

src/pages/
├── PatientListPage.tsx          # NEW
├── PatientDetailPage.tsx        # NEW

src/hooks/
├── usePatient.ts                # Patient CRUD + allergies/medications
```

### 10. Seed Data Updates

Update the existing seed script to give the demo patients richer data:
- Each patient gets: sex, height, eye color, blood type
- Each patient gets 1-2 allergies with severity levels
- Each patient gets 1-2 medications with dosages and frequencies
- Any existing demo sessions should include vitals records
