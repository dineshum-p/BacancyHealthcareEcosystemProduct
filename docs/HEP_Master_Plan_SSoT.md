**SINGLE SOURCE OF TRUTH**

**Healthcare Ecosystem Platform**

**Master Product & Engineering Plan**

*Feature Matrix · MVP Definition · Architecture · Tech Stack · Roadmap*

  ---------------------------- ------------------------------------------
  **Attribute**                

  Document type                Single Source of Truth --- Master Plan

  Product                      Healthcare Ecosystem Platform (HEP)

  Version                      1.0 --- June 2026

  Source documents             PRD v1.0 · Modular Architecture Guide v1.0
                               · Billing Spec v1.0

  Status                       Approved for Engineering Execution

  Audience                     Product · Engineering · Design · QA ·
                               DevOps · Leadership
  ---------------------------- ------------------------------------------

*Confidential --- Internal Use Only*

**1. Vision, Mission & Strategic Goals**

  -----------------------------------------------------------------------
  **Vision: To create a unified digital healthcare ecosystem that
  empowers every participant --- from clinic administrators and
  physicians to pharmacists and insurance adjusters --- with the tools,
  data, and workflows necessary to deliver better patient outcomes at
  lower operational cost.**

  -----------------------------------------------------------------------

HEP is a cloud-native, multi-tenant SaaS platform that digitally unifies
Clinics, Pharmacies, Doctors, Patients, and Medical Insurance Companies
on a single interoperable platform. Every module can be deployed
independently or in combination, governed by strict role-based access
controls and complete tenant data isolation.

**1.1 Strategic Goals**

-   Eliminate paper-based workflows across all healthcare touchpoints

-   Enable real-time insurance pre-authorization and claims adjudication

-   Provide a single longitudinal patient health record accessible
    across tenants with consent

-   Reduce prescription errors through digital e-prescribing and
    pharmacy dispensing flows

-   Deliver actionable analytics to all stakeholder types via
    role-specific dashboards

-   Ensure regulatory compliance (HIPAA, GDPR, HITECH, SOC 2 Type II)
    across all tenants

-   Generate sustainable revenue through a modular onboarding +
    usage-based billing model

**1.2 Platform Success Metrics**

  -------------------------- --------------- -------------- --------------
  **KPI**                    **Baseline**    **Year 1       **Year 2
                                             Target**       Target**

  Onboarded tenants          0               50+            200+

  Active patients            0               100,000        500,000

  E-prescription             \< 5%           70%            95%
  digitization rate                                         

  Insurance claim processing \> 5 days       \< 48 hrs      \< 12 hrs
  time                                                      

  System uptime              ---             99.5%          99.9%

  NPS (user satisfaction)    ---             \> 40          \> 60

  MRR (monthly recurring     \$0             \$250K         \$1.2M
  revenue)                                                  
  -------------------------- --------------- -------------- --------------

**2. Stakeholders & User Personas**

  -------------- --------------- --------------- ----------------------------
  **Tenant       **Primary       **Key Roles**   **Core Need**
  Type**         Users**                         

  **Clinic**     Admin,          Scheduler,      Manage appointments, EMR,
                 Receptionist,   Billing Mgr     billing & insurance claims
                 Nurse                           

  **Pharmacy**   Pharmacist,     Dispenser,      Fill prescriptions, manage
                 Technician      Inventory       stock, process pharmacy
                                 Controller      claims

  **Doctor**     GP, Specialist, Attending,      Diagnose, prescribe,
                 Resident        Referring,      document, refer &
                                 Consulting      telemedicine

  **Insurance    Adjuster,       Claims Analyst, Authorize treatments,
  Co.**          Underwriter     Auth Reviewer   adjudicate claims, manage
                                                 networks

  **Patient**    Adult, Minor,   Self,           Book appointments, view
                 Caregiver       Dependent, POA  health records, track
                                                 coverage & pay bills

  **Super        Platform Owner  System Admin,   Manage tenants, configure
  Admin**                        Support         platform, compliance &
                                                 billing oversight
  -------------- --------------- --------------- ----------------------------

**3. Complete Feature List --- Module by Module**

Every feature below is tagged with its functional category. Features
marked MVP are included in the first launch; Enhancement features ship
in later phases. Full MVP/Enhancement mapping appears in Section 5.

**3.1 Clinic Module**

*Ideal for: Standalone clinics, group practices, hospital outpatient
departments, HMOs*

  -------------- ------------------- -----------------------------------------
  **Tag**        **Feature**         **Description**

  **PATIENT**    **Patient           Online self + walk-in, MRN generation,
                 Registration**      duplicate detection, dependent linking,
                                     consent forms

  **PATIENT**    **Identity          Government ID upload, optional biometric;
                 Verification**      KYC integration

  **EMR**        **Longitudinal      Visits, diagnoses, medications,
                 Patient Timeline**  allergies, immunizations, vitals ---
                                     chronological

  **EMR**        **Problem List &    ICD-10/11 coded diagnosis list with
                 Diagnoses**         active/resolved status

  **EMR**        **Vital Signs       BP, temp, weight, height, SpO2, BMI with
                 Tracking**          trend graphs

  **EMR**        **Allergy           Drug, food, environmental allergies with
                 Registry**          severity
                                     (mild/moderate/severe/life-threatening)

  **EMR**        **Clinical Notes    Structured
                 (SOAP)**            Subjective-Objective-Assessment-Plan
                                     editor with voice-to-text

  **EMR**        **Document          Referral letters, discharge summaries,
                 Attachments**       imaging reports, lab PDFs

  **SCHEDULE**   **Multi-Provider    Conflict detection, resource allocation,
                 Scheduling**        appointment types
                                     (consult/follow-up/procedure/TH/group)

  **SCHEDULE**   **Waiting List      Auto-notify patients when slots open;
                 Management**        priority ordering

  **SCHEDULE**   **Digital           QR code or kiosk-based; real-time queue
                 Check-In**          display with wait time

  **SCHEDULE**   **Appointment       SMS, email, and push notifications;
                 Reminders**         configurable lead times

  **ORDER**      **Lab Test Orders** Specimen collection workflow, LIS
                                     integration, result routing back to EMR

  **ORDER**      **Radiology         DICOM viewer integration, imaging result
                 Orders**            attachment to patient record

  **ORDER**      **Referral          Internal and external with auto-populated
                 Generation**        referral letter; closed-loop feedback

  **BILLING**    **Encounter         ICD/CPT mapping, multi-payer
                 Billing**           (cash/insurance/corporate), co-pay
                                     calculation

  **BILLING**    **Insurance         Real-time payer API call at check-in;
                 Eligibility**       coverage confirmation before service

  **BILLING**    **Claim             EDI 837, HL7, FHIR formats; direct
                 Generation**        submission to insurer

  **BILLING**    **Payment           Card, mobile wallet, bank transfer, cash;
                 Collection**        patient statement & payment plans

  **BILLING**    **AR & Revenue      Aging report, denial reasons, collection
                 Analytics**         rates, RCM dashboard

  **REPORT**     **Analytics         Appointments, revenue, provider
                 Dashboard**         productivity, population health ---
                                     daily/weekly/monthly
  -------------- ------------------- -----------------------------------------

**3.2 Pharmacy Module**

*Ideal for: Retail pharmacies, hospital dispensaries, specialty pharmacy
chains*

  --------------- ------------------- ----------------------------------------
  **Tag**         **Feature**         **Description**

  **RX**          **E-Prescription    Electronic Rx from clinic/doctor module;
                  Receipt**           prescriber credential verification

  **RX**          **Manual Rx Entry** Paper prescription digitization with
                                      pharmacist validation and DEA schedule
                                      check

  **RX**          **Duplicate         Cross-branch duplicate Rx
                  Detection**         identification; early-refill alerts

  **RX**          **Priority Queue**  Urgent / regular / controlled substance
                                      queue with status flags

  **DISPENSE**    **7-Step Workflow** Verify → Pick → Count → Label → Clinical
                                      Check → Counsel → Dispense checklist

  **DISPENSE**    **Drug Interaction  Drug-drug, drug-allergy contraindication
                  Check**             at dispensing step

  **DISPENSE**    **Label             Multi-language dispensing labels with
                  Generation**        dosage instructions

  **DISPENSE**    **Partial Fill      Controlled substance partial fills;
                  Management**        stock shortage handling

  **INVENTORY**   **Real-Time Stock** Multi-branch stock levels; minimum
                                      threshold auto-reorder triggers

  **INVENTORY**   **Batch & Expiry    Lot numbers, expiry dates, 30/60/90-day
                  Tracking**          near-expiry alerts

  **INVENTORY**   **Cold Chain        IoT temperature sensor integration for
                  Monitoring**        temperature-sensitive medications

  **INVENTORY**   **Procurement &     Purchase orders, supplier scorecard,
                  POs**               goods receipt verification

  **CLAIMS**      **Pharmacy Claim    NCPDP D.0 standard; real-time
                  Submission**        adjudication; rejection workflow

  **CLAIMS**      **Formulary         Drug coverage tier, quantity limits,
                  Lookup**            prior auth flags at point of dispensing

  **PATIENT**     **Medication Sync & Auto-refill program; sync all chronic
                  Refills**           meds to one pickup date; home delivery

  **PATIENT**     **MTM Sessions**    Medication therapy management scheduling
                                      and documentation

  **COMPLY**      **PDMP**            Prescription Drug Monitoring Program
                                      submission and query for controlled
                                      substances

  **COMPLY**      **Regulatory        DEA reconciliation, state board
                  Reports**           inspection-ready reports,
                                      return/disposal logs
  --------------- ------------------- ----------------------------------------

**3.3 Doctor / Physician Module**

*Ideal for: Independent physicians, specialist practices, telehealth
providers*

  ----------- ------------------- ----------------------------------------
  **Tag**     **Feature**         **Description**

  **DASH**    **Doctor            Today\'s schedule, pending actions,
              Dashboard**         critical alerts, unread messages

  **NOTES**   **SOAP Note         Structured note with voice-to-text;
              Editor**            specialty smart templates (cardio, peds,
                                  ortho...)

  **NOTES**   **ICD-10/11         Inline diagnosis search with clinical
              Coding**            terminology; auto-code suggestion

  **NOTES**   **Co-Signature      Resident/intern notes require attending
              Workflow**          physician approval before finalizing

  **NOTES**   **Medical           Sick leave, fitness-to-work,
              Certificates**      fitness-for-sport; custom branding
                                  templates

  **eRX**     **Drug Database**   Generic/brand name lookup, drug
                                  monograph, dosage calculator (pediatric
                                  weight-based)

  **eRX**     **Interaction       Drug-drug (Major/Moderate/Minor),
              Alerts**            drug-allergy contraindication

  **eRX**     **Formulary Check** Against patient\'s active insurance
                                  plan; tier and quantity limit display

  **eRX**     **Controlled Rx**   DEA number validation, full audit trail,
                                  Schedule II--V support

  **eRX**     **Refill            Patient refill requests handled in-app;
              Authorization**     approve/deny with audit

  **TH**      **HD Video          Screen sharing, virtual whiteboard,
              Consult**           waiting room; session recording
                                  (consent-gated)

  **TH**      **Async             Patient submits photos + questions;
              Consultation**      doctor responds with structured reply

  **REFER**   **Referral          Internal specialist referral; external
              Management**        with auto-fax/email; closed-loop
                                  tracking

  **CME**     **CME Tracker**     Credit log, license renewal reminders,
                                  board certification tracking
  ----------- ------------------- ----------------------------------------

**3.4 Insurance Company Module**

*Ideal for: Health insurers, TPAs, self-insured corporate health plans*

  ------------- ----------------------- ----------------------------------------
  **Tag**       **Feature**             **Description**

  **POLICY**    **Policy                Individual, family, group/corporate
                Administration**        plans; coverage definitions; renewals;
                                        endorsements

  **POLICY**    **Rate Table            Age-banding, risk factor adjustments;
                Management**            waiting periods; exclusions

  **MEMBER**    **Member Enrollment**   Corporate bulk (CSV/API), individual
                                        self-enrollment; dependent management

  **MEMBER**    **Digital ID Card**     Auto-generated on enrollment; mobile
                                        wallet (Apple/Google Pay) delivery

  **MEMBER**    **COBRA Admin**         Continuation coverage management and
                                        deadline tracking

  **NETWORK**   **Provider Directory**  Searchable map;
                                        in-network/out-of-network designation;
                                        benefit differentials

  **NETWORK**   **Credentialing**       Provider credential verification,
                                        contract management, fee schedule

  **AUTH**      **Prior Authorization** E-PA intake; auto-approve engine for
                                        routine requests; peer-to-peer review

  **AUTH**      **Auth Status Portal**  Real-time status for providers and
                                        members

  **AUTH**      **Utilization Review**  Concurrent (inpatient) and retrospective
                                        review; case management

  **CLAIMS**    **Claims Intake**       EDI 837, FHIR, OCR for paper; duplicate
                                        detection; eligibility check at intake

  **CLAIMS**    **Auto-Adjudication**   Configurable rules engine; ICD/CPT/DRG
                                        audit; COB processing

  **CLAIMS**    **FWA Detection**       ML anomaly scoring; fraud investigation
                                        workflow

  **CLAIMS**    **EOB Generation**      Explanation of Benefits for members and
                                        providers

  **PAYMENT**   **EFT & ERA**           ACH/SEPA provider payments; ERA in 835
                                        format; member reimbursements

  **APPEALS**   **Appeals Workflow**    Multi-level: first review → medical
                                        review → IRO; statutory deadline
                                        tracking

  **REPORT**    **Regulatory Reports**  HEDIS, MLR, state-mandated filings;
                                        claims loss ratio dashboards
  ------------- ----------------------- ----------------------------------------

**3.5 Patient Portal Module**

*Ideal for: Patient-facing digital front door across any combination of
connected modules*

  ------------- ------------------- ----------------------------------------
  **Tag**       **Feature**         **Description**

  **ACCT**      **Registration &    Email/phone + OTP; ID document upload;
                Profile**           preferred language; accessibility
                                    settings

  **ACCT**      **Family Account**  Add dependents with relationship roles;
                                    guardian-controlled minor accounts

  **BOOK**      **Self-Booking**    Doctor/clinic search by specialty,
                                    location, language; real-time slot
                                    booking

  **BOOK**      **Telehealth        Pre-session tech check; virtual waiting
                Booking**           room; instant confirmation

  **BOOK**      **Appointment       Modify, cancel, reschedule; policy-based
                Management**        cancellation rules; reminders

  **RECORDS**   **Visit History**   Encounter summaries, diagnoses,
                                    treatment plans; doctor notes
                                    (patient-readable)

  **RECORDS**   **Lab & Imaging     Results with patient-friendly
                Results**           interpretation; trend graphs

  **RECORDS**   **Medication        Active/inactive list; refill request
                History**           submission

  **RECORDS**   **Immunization      Vaccination history; preventive care
                Records**           reminders

  **RECORDS**   **PHR Export**      CCD/CCDA format personal health record
                                    download

  **INS**       **Insurance &       Card management; coverage summary;
                Benefits**          remaining deductible; OOP max tracker

  **INS**       **Claim Tracking**  Real-time claim status; EOB document
                                    access

  **BILLING**   **Invoice &         View invoices; online payment
                Payment**           (card/wallet); receipt downloads

  **COMMS**     **Secure            Encrypted messaging with care team
                Messaging**         members

  **COMMS**     **Referral          Sent → accepted → scheduled → completed
                Tracking**          status visible to patient
  ------------- ------------------- ----------------------------------------

**3.6 Platform Core --- Always Included**

The following services are provisioned for every tenant regardless of
module selection:

  ------------------ ----------------------------------------------------
  **Service**        **What it provides**

  Multi-tenancy &    Dedicated DB schema per tenant; row-level security;
  Isolation          cross-tenant data only via patient consent tokens

  Auth (OAuth 2.0 +  JWT sessions; MFA mandatory for clinical roles; SSO
  OIDC)              support; Keycloak-based

  RBAC + ABAC        Role + attribute-based permissions; time-bound
                     access grants; department-scoped roles

  Audit Trail        Every action: user, role, IP, timestamp, resource;
                     tamper-evident logs

  Notification       SMS, email, push (iOS/Android), in-app; event-driven
  Engine             triggers; tenant templates

  File Storage       AES-256 encrypted object storage; regional data
  (HIPAA)            residency; lifecycle policies

  FHIR R4 API        Standard health data exchange; rate limiting; SMART
  Gateway            on FHIR for 3rd-party apps

  Billing Engine     Usage metering, invoice generation, onboarding fee
                     management, payment processing

  Super Admin        Tenant lifecycle, feature flags, SLA monitoring,
  Console            support tickets, platform analytics
  ------------------ ----------------------------------------------------

**4. Cross-Module Integration Flows**

When a tenant activates more than one module, the platform automatically
activates the corresponding data integration flows listed below. These
flows use the shared event bus and FHIR R4 API layer --- no additional
configuration is required.

+-----------------+----------------------------------------------------+
| **Module Pair** | **Integration Flows Auto-Activated**               |
+-----------------+----------------------------------------------------+
| **Clinic ↔      | -   Appointment created in Clinic → Doctor         |
| Doctor**        |     receives pre-populated demographics + nursing  |
|                 |     vitals                                         |
|                 |                                                    |
|                 | -   Doctor finalises SOAP notes → Auto-saved to    |
|                 |     Clinic EMR patient timeline                    |
|                 |                                                    |
|                 | -   Doctor generates referral → Clinic routes and  |
|                 |     tracks status with closed-loop feedback        |
|                 |                                                    |
|                 | -   Clinic billing reads ICD codes from doctor     |
|                 |     notes for claim generation                     |
+-----------------+----------------------------------------------------+
| **Clinic ↔      | -   Doctor e-prescription → Automatically routed   |
| Pharmacy**      |     to patient\'s preferred pharmacy               |
|                 |                                                    |
|                 | -   Pharmacy dispensing status                     |
|                 |     (dispensed/pending/partial) → Back to Clinic   |
|                 |     patient record                                 |
|                 |                                                    |
|                 | -   Drug interaction check uses Clinic allergy     |
|                 |     registry and active medication list            |
|                 |                                                    |
|                 | -   Clinic billing can consolidate pharmacy        |
|                 |     charges in bundled insurance claims            |
+-----------------+----------------------------------------------------+
| **Clinic ↔      | -   Patient books appointment via portal → Appears |
| Patient         |     in Clinic scheduling queue in real time        |
| Portal**        |                                                    |
|                 | -   Consultation notes and lab results posted →    |
|                 |     Patient notified and visible in portal         |
|                 |                                                    |
|                 | -   Patient refill request via portal → Routed to  |
|                 |     Clinic doctor for authorization                |
|                 |                                                    |
|                 | -   Clinic invoice generated → Patient receives    |
|                 |     and can pay online via portal                  |
+-----------------+----------------------------------------------------+
| **Doctor ↔      | -   Doctor writes e-prescription → Sent to         |
| Pharmacy**      |     pharmacy with formulary pre-check              |
|                 |                                                    |
|                 | -   Pharmacy sends dispensing confirmation → Back  |
|                 |     to prescribing doctor                          |
|                 |                                                    |
|                 | -   Pharmacy requests refill auth → Doctor         |
|                 |     receives in-app; approve/deny with one click   |
+-----------------+----------------------------------------------------+
| **Clinic /      | -   Real-time eligibility check triggered at       |
| Doctor ↔        |     patient check-in                               |
| Insurance**     |                                                    |
|                 | -   Prior auth requests submitted directly from    |
|                 |     Clinic/Doctor to insurer; approval in real     |
|                 |     time                                           |
|                 |                                                    |
|                 | -   Claims from Clinic billing submitted via       |
|                 |     API/EDI; adjudication status fed back          |
|                 |                                                    |
|                 | -   Denial reason codes trigger rework queue in    |
|                 |     Clinic billing module                          |
+-----------------+----------------------------------------------------+
| **Insurance ↔   | -   Member views active policy, remaining          |
| Patient         |     deductibles, and benefit summary in portal     |
| Portal**        |                                                    |
|                 | -   Claim status and EOB documents visible within  |
|                 |     24h of adjudication                            |
|                 |                                                    |
|                 | -   Prior authorization status visible to patient  |
|                 |     for transparency                               |
+-----------------+----------------------------------------------------+
| **Pharmacy ↔    | -   Patient sees prescription queue status and     |
| Patient         |     estimated pickup time in portal                |
| Portal**        |                                                    |
|                 | -   Refill reminders pushed through portal         |
|                 |     notification center                            |
|                 |                                                    |
|                 | -   Patient selects home delivery via portal;      |
|                 |     pharmacy fulfills and updates tracking         |
+-----------------+----------------------------------------------------+

**5. MVP vs. Enhancement --- Feature Classification**

  -----------------------------------------------------------------------
  **MVP = Features required at first public launch (Months 1--9).
  Enhancement = Post-MVP improvements delivering additional value (Months
  10--20+). MVP scope is deliberately focused to maximize launch speed
  and validate core user journeys before expanding.**

  -----------------------------------------------------------------------

**5.1 Platform Core**

  --------------------- ----------------- ---------------------------------------
  **Feature**           **Phase**         **Scope / Notes**

  Multi-tenancy         **MVP**           Foundation; without this nothing else
  isolation (DB schema                    works
  per tenant)                             

  JWT Auth + MFA        **MVP**           Security non-negotiable from Day 1

  RBAC permission       **MVP**           Required for all role-based feature
  system                                  gating

  Tenant onboarding     **MVP**           Required before any tenant can go live
  flow (Super Admin)                      

  Audit trail (all user **MVP**           HIPAA requirement; must be present at
  actions)                                launch

  Notification engine   **MVP**           Appointment reminders drive patient
  (SMS + Email)                           adoption

  FHIR R4 API gateway   **MVP**           Enables all module interoperability

  Usage metering &      **MVP**           Revenue model depends on accurate
  invoice generation                      metering from Day 1

  Push notifications    **Enhancement**   Nice-to-have post-launch; SMS covers
  (iOS/Android)                           MVP need

  ABAC fine-grained     **Enhancement**   RBAC sufficient for MVP; ABAC adds
  policies                                complexity

  SMART on FHIR         **Enhancement**   Phase 3+ ecosystem play
  3rd-party app launch                    

  BI dashboards &       **Enhancement**   Basic dashboards MVP; advanced BI
  ad-hoc query builder                    post-launch

  SSO / SAML enterprise **Enhancement**   Enterprise tier requirement; not needed
  auth                                    for initial customers
  --------------------- ----------------- ---------------------------------------

**5.2 Clinic Module**

  --------------------- ----------------- ---------------------------------------
  **Feature**           **Phase**         **Scope / Notes**

  Patient registration  **MVP**           Core patient intake; Day 1 requirement
  (walk-in + online)                      

  MRN generation &      **MVP**           Data integrity from first patient
  duplicate detection                     

  Appointment           **MVP**           Primary clinic workflow
  scheduling (single                      
  provider)                               

  SMS + email           **MVP**           Direct impact on no-show rate
  appointment reminders                   

  Basic EMR (SOAP       **MVP**           Minimum viable clinical record
  notes, vitals,                          
  allergies,                              
  medications)                            

  ICD-10/11 diagnosis   **MVP**           Required for billing from Day 1
  coding                                  

  Cash billing &        **MVP**           Revenue collection for clinic
  patient invoicing                       

  Insurance eligibility **MVP**           Prevents claim rejections
  check (basic API)                       

  EDI 837 claim         **MVP**           Required for insurance-paying patients
  generation                              

  Lab result attachment **MVP**           Simple result storage until LIS
  (PDF upload)                            integration ready

  Multi-provider /      **Enhancement**   Add after single-provider flow is
  multi-resource                          stable
  scheduling                              

  QR code digital       **Enhancement**   Kiosk/QR is a UX enhancement; manual
  check-in                                check-in is MVP

  DICOM radiology       **Enhancement**   Complex integration; Phase 2
  viewer                                  

  Real-time queue       **Enhancement**   Operational enhancement post-launch
  display                                 

  LIS integration (auto **Enhancement**   Phase 2 integration sprint
  lab results)                            

  AR aging & denial     **Enhancement**   Billing team enhancement; basic report
  management dashboard                    at MVP

  Population health     **Enhancement**   Phase 3+ data science feature
  analytics                               

  Recurring appointment **Enhancement**   Phase 2 scheduling enhancement
  support                                 
  --------------------- ----------------- ---------------------------------------

**5.3 Doctor Module**

  --------------------- ----------------- ---------------------------------------
  **Feature**           **Phase**         **Scope / Notes**

  Doctor dashboard      **MVP**           First screen doctors see; must be
  (schedule + pending                     excellent
  actions)                                

  SOAP note editor      **MVP**           Primary clinical documentation tool

  ICD-10/11 inline      **MVP**           Required for diagnosis coding during
  diagnosis search                        note

  Basic e-prescribing   **MVP**           Core workflow; biggest patient safety
  (drug lookup + send                     impact
  to pharmacy)                            

  Drug-drug interaction **MVP**           Patient safety; Moderate/Minor are
  alerts (Major only at                   Enhancement
  MVP)                                    

  Drug-allergy          **MVP**           Patient safety; non-negotiable
  contraindication                        
  check                                   

  Referral generation   **MVP**           Common workflow between doctors in same
  (internal)                              clinic

  Medical certificate   **MVP**           High-frequency use case; easy to
  generation                              implement

  Formulary check       **Enhancement**   Requires insurance module to be active
  against insurance                       

  Controlled substance  **Enhancement**   Regulatory complexity; Phase 2
  prescribing (DEA)                       

  Voice-to-text SOAP    **Enhancement**   AI feature; Phase 2
  notes                                   

  Specialty smart note  **Enhancement**   Phase 2 after core note flow is stable
  templates                               

  HD video telemedicine **Enhancement**   Phase 2; significant infrastructure
                                          work

  Async consultation    **Enhancement**   Phase 3; separate patient-facing flow

  CME tracker           **Enhancement**   Low priority; Phase 3

  External referral     **Enhancement**   Phase 2 after internal referral is live
  (auto-fax/email)                        

  Co-signature workflow **Enhancement**   Phase 2; requires resident/intern roles
  --------------------- ----------------- ---------------------------------------

**5.4 Pharmacy Module**

  --------------------- ----------------- ---------------------------------------
  **Feature**           **Phase**         **Scope / Notes**

  E-prescription        **MVP**           Core intake flow
  receipt from                            
  clinic/doctor                           

  Manual Rx entry       **MVP**           Hybrid workflow needed at launch
  (paper prescription)                    

  7-step dispensing     **MVP**           Clinical workflow safety from Day 1
  workflow checklist                      

  Drug interaction      **MVP**           Patient safety
  check at dispensing                     

  Dispensing label      **MVP**           Legal requirement in all jurisdictions
  generation                              

  Real-time stock       **MVP**           Inventory control from Day 1
  levels (single                          
  branch)                                 

  Batch & expiry        **MVP**           Regulatory compliance requirement
  tracking                                

  Basic pharmacy claim  **MVP**           Revenue collection for pharmacy
  submission (NCPDP)                      

  Co-pay calculation    **MVP**           Point-of-sale collection
  and patient payment                     

  Refill reminders      **MVP**           Patient retention / adherence
  (SMS)                                   

  Multi-branch stock    **Enhancement**   Phase 2 for pharmacy chains
  management                              

  Cold chain IoT        **Enhancement**   Phase 2 specialty pharmacy requirement
  monitoring                              

  Auto-reorder triggers **Enhancement**   Phase 2 inventory automation

  Purchase order &      **Enhancement**   Phase 2 procurement module
  supplier management                     

  PDMP submission       **Enhancement**   Jurisdiction-specific; Phase 2

  Medication            **Enhancement**   Phase 2 patient service enhancement
  synchronization                         

  MTM sessions          **Enhancement**   Phase 3 clinical pharmacy service

  Home delivery         **Enhancement**   Phase 3; requires courier API
  management                              integration
  --------------------- ----------------- ---------------------------------------

**5.5 Insurance Module**

  --------------------- ----------------- ---------------------------------------
  **Feature**           **Phase**         **Scope / Notes**

  Policy creation       **MVP**           Core insurance product administration
  (individual + group)                    

  Member enrollment     **MVP**           Self-service enrollment at launch
  (individual portal)                     

  Coverage definition   **MVP**           Required to calculate patient
  (benefits, co-pay,                      responsibility
  deductible)                             

  Digital member ID     **MVP**           High patient expectation; simple to
  card generation                         implement

  Prior authorization   **MVP**           Core workflow connecting to
  intake & auto-approve                   clinic/doctor

  Basic claims intake   **MVP**           Revenue from claims processing
  (EDI 837 + FHIR)                        

  Automated             **MVP**           Core of insurance module value
  adjudication engine                     

  EOB generation        **MVP**           Regulatory requirement in most markets

  EFT provider payments **MVP**           Provider network retention

  Corporate bulk        **Enhancement**   Phase 2 for large corporate clients
  enrollment (CSV)                        

  FWA ML detection      **Enhancement**   Phase 3; requires sufficient data
                                          volume

  COBRA administration  **Enhancement**   Phase 2 US-market feature

  Utilization review    **Enhancement**   Phase 2 clinical management feature
  (concurrent)                            

  Network adequacy      **Enhancement**   Phase 2 regulatory reporting
  reporting                               

  HEDIS reporting       **Enhancement**   Phase 3 regulatory compliance feature

  IRO integration       **Enhancement**   Phase 3 appeals escalation path
  (appeals)                               

  OCR paper claim       **Enhancement**   Phase 2; requires ML OCR pipeline
  processing                              
  --------------------- ----------------- ---------------------------------------

**5.6 Patient Portal**

  --------------------- ----------------- ---------------------------------------
  **Feature**           **Phase**         **Scope / Notes**

  Patient registration  **MVP**           Self-service account creation
  (email/phone + OTP)                     

  Appointment           **MVP**           Primary patient engagement driver
  self-booking                            

  Appointment reminders **MVP**           Reduces no-shows; measurable ROI

  View visit history &  **MVP**           Core health record access
  consultation notes                      

  View lab results      **MVP**           High-demand patient use case

  Medication history &  **MVP**           Convenience + adherence
  refill request                          

  Insurance card &      **MVP**           Reduces calls to clinic/insurer
  benefit summary                         

  Invoice view & online **MVP**           Self-service billing
  payment                                 

  Claim status tracking **MVP**           Reduces inbound support calls to
                                          insurer

  Secure messaging with **MVP**           Replaces unsecured email/WhatsApp
  care team                               

  Family account /      **Enhancement**   Phase 2; complex consent logic
  dependent management                    

  PHR export (CCD/CCDA) **Enhancement**   Phase 2; interoperability feature

  Telehealth booking    **Enhancement**   Requires Doctor TH module to be live

  Immunization records  **Enhancement**   Phase 2 preventive care feature

  Referral tracking     **Enhancement**   Phase 2; depends on referral module

  Health education      **Enhancement**   Phase 3 content investment
  content library                         

  Biometric device data **Enhancement**   Phase 3 IoT integration
  (glucometer, BP)                        
  --------------------- ----------------- ---------------------------------------

**6. Billing Model Summary**

HEP uses a two-part model: a one-time onboarding fee at contract
signing, followed by a monthly platform base fee plus usage-based
charges metered per module transaction event.

**6.1 Onboarding Fees (One-Time)**

  ------------------ -------------- ----------------- -------------------------
  **Module**         **First-Time   **Re-Activation   **Covers**
                     Fee**          Fee**             

  **Clinic**         **\$5,000**    \$2,000           Setup, migration (50K
                                                      records), 3 integrations,
                                                      2× training sessions,
                                                      14-day hypercare

  **Pharmacy**       **\$4,000**    \$1,600           Setup, migration,
                                                      integrations, training,
                                                      hypercare

  **Doctor**         **\$3,000**    \$1,200           Setup, migration,
                                                      integrations, training,
                                                      hypercare

  **Insurance**      **\$8,000**    \$3,200           Setup, migration,
                                                      integrations, training,
                                                      hypercare

  **Patient Portal** **\$2,000**    \$800             Setup, migration,
                                                      integrations, training,
                                                      hypercare

  **Multi-module     5--25% off     ---               2 modules=5%, 3=10%,
  discount**         total                            4=15%, All 5=25% off
                                                      combined onboarding
  ------------------ -------------- ----------------- -------------------------

**6.2 Monthly Recurring Charges**

  ---------------- ---------------- ---------------- --------------------
  **Module**       **Billable       **Pricing        **Rate Range**
                   Event**          Tiers**          

  **Platform       Flat monthly fee Starter / Growth \$500 / \$800 /
  base**                            / Enterprise     \$1,200 per month

  **Clinic**       Per              4 tiers (500 /   \$2.50 → \$1.00 per
                   e-prescription   1,500 / 3,000 /  Rx
                   transmitted      \>3,000 Rx)      

  **Pharmacy**     Per dispensing   4 tiers (500 /   \$3.00 → \$1.50 per
                   bill finalised   1,500 / 3,000 /  Bill
                                    \>3,000 Bills)   

  **Doctor**       Per consultation 4 tiers (300 /   \$4.00 → \$2.00 per
                   note signed      800 / 1,500 /    Consult
                                    \>1,500          
                                    Consults)        

  **Insurance**    Per claim        4 tiers (200 /   \$5.00 → \$2.00 per
                   adjudicated      600 / 1,500 /    Claim
                                    \>1,500 Claims)  

  **Patient        Per unique       4 tiers (1K / 3K \$0.50 → \$0.20 per
  Portal**         active           / 6K / \>6K      Patient
                   patient/month    Patients)        
  ---------------- ---------------- ---------------- --------------------

**6.3 Billing Engine --- Technical Requirements (MVP)**

-   Real-time event metering: every billable event emitted to billing
    topic on event bus with tenant ID, module, timestamp, user

-   Counter service: aggregates events per tenant per module per
    calendar month; Redis-backed with PostgreSQL persistence

-   Invoice generator: runs on month+1 day 1; calculates tiered cost;
    generates invoice PDF; emails billing contact

-   Payment gateway integration: Stripe (card) + Plaid (ACH); auto-debit
    on payment due date

-   Billing admin portal: live usage dashboard, invoice history, payment
    management, dispute submission

-   Budget alert webhooks: fire at 50%, 75%, 90% of configured monthly
    cap per module

-   Audit log: every billing event logged for dispute resolution with
    raw event detail

**7. System Architecture**

**7.1 Architecture Principles**

-   Domain-Driven Design: each module maps to a bounded context with its
    own service, schema, and API surface

-   Microservices: independently deployable services per domain; no
    shared mutable state between services

-   Event-Driven: inter-service communication via event bus (Kafka);
    synchronous REST only for direct user-facing requests

-   CQRS: command/query separation on high-throughput domains
    (appointments, claims, EMR read path)

-   API Gateway: single entry point handling auth, rate limiting,
    routing, tenant resolution

-   Multi-Tenancy: schema-per-tenant isolation within shared PostgreSQL
    cluster; tenant context injected at request layer

-   Zero-Trust Security: every service-to-service call authenticated; no
    implicit trust inside the cluster

**7.2 High-Level System Layers**

  ------------------ ----------------------------------------------------
  **Layer**          **Components**

  Client Layer       Next.js Web (SSR/PWA) · React Native iOS/Android ·
                     Third-party FHIR clients via SMART on FHIR

  API Gateway        Kong / AWS API Gateway --- auth token validation,
                     tenant routing, rate limiting, request logging

  Service Layer      12 NestJS microservices (see Section 7.3) --- each
                     independently deployable as a Docker container

  Event Bus          Apache Kafka --- async inter-service events; topics
                     per domain; consumer groups per subscriber

  Data Layer         PostgreSQL on Amazon RDS (Multi-AZ primary + read
                     replica) · Redis on EC2 (cache + sessions) ·
                     Elasticsearch on EC2 (search)

  File Storage       AWS S3 (HIPAA-eligible) · CloudFront CDN for non-PHI
                     assets

  Infra /            Docker + Docker Compose on EC2 Auto Scaling Groups ·
  Orchestration      Amazon RDS (PostgreSQL) · Terraform IaC ·
                     Application Load Balancer

  Observability      Prometheus + Grafana (metrics) · ELK Stack (logs) ·
                     Jaeger (distributed tracing) · PagerDuty (alerts)
  ------------------ ----------------------------------------------------

**7.3 Microservice Breakdown**

  ---------------------- ------------------ -------------------------------------
  **Service**            **Domain**         **Responsibilities**

  tenant-service         Platform Core      Tenant lifecycle, schema
                                            provisioning, feature flags, config
                                            management

  auth-service           Platform Core      JWT issuance, MFA, OAuth2/OIDC flows,
                                            session management, Keycloak
                                            integration

  notification-service   Platform Core      SMS (Twilio), email (SendGrid), push
                                            (FCM/APNs), in-app; template
                                            rendering

  billing-service        Platform Core      Usage event consumption, invoice
                                            generation, payment processing,
                                            dispute management

  patient-service        Clinic / Patient   Patient registration, MRN,
                                            demographics, consent management,
                                            family linking

  emr-service            Clinic / Doctor    EMR records, SOAP notes, vitals,
                                            diagnoses, lab results, documents,
                                            referrals

  scheduling-service     Clinic             Appointment CRUD, provider calendars,
                                            queue management, reminders trigger

  erx-service            Doctor / Pharmacy  E-prescription lifecycle, drug DB,
                                            interaction checks, pharmacy routing

  pharmacy-service       Pharmacy           Dispensing workflow, inventory,
                                            procurement, PDMP, pharmacy billing

  insurance-service      Insurance          Policy admin, member enrollment,
                                            prior auth engine, claims
                                            adjudication, payments

  portal-service         Patient Portal     Patient-facing aggregation API ---
                                            health records, booking, billing,
                                            messaging

  analytics-service      Cross-cutting      Dashboard data, report generation, BI
                                            queries, usage aggregation
  ---------------------- ------------------ -------------------------------------

**7.4 Data Architecture**

**Multi-Tenant Database Strategy**

-   Schema-per-tenant within a shared PostgreSQL cluster (Amazon RDS for
    PostgreSQL, Multi-AZ with a read replica)

-   Tenant context injected at application layer via middleware; no
    cross-schema queries permitted

-   Search index per tenant in Elasticsearch; tenant ID mandatory on
    every document

-   Redis prefix isolation: all keys prefixed with tenant_id to prevent
    cache cross-contamination

-   PHI fields encrypted at column level (pgcrypto) in addition to
    disk-level AES-256 encryption

**Key Domain Data Models**

  --------------- -------------------------------------------------------
  **Entity**      **Key Fields**

  Tenant          tenant_id, name, modules\[\], schema_name,
                  billing_tier, status, config_json

  Patient         patient_id, tenant_id, mrn, demographics, consent\[\],
                  emergency_contact, insurance\[\]

  Encounter       encounter_id, patient_id, doctor_id, clinic_id, type,
                  status, notes\[\], orders\[\], diagnoses\[\]

  Prescription    rx_id, encounter_id, doctor_id, drug_code, dosage,
                  instructions, pharmacy_id, status, transmitted_at

  Dispensing      dispense_id, rx_id, pharmacist_id, steps\[\],
                  label_printed, counselled, bill_id, dispensed_at

  Claim           claim_id, tenant_id, patient_id, encounter_id,
                  insurer_id, icd_codes\[\], cpt_codes\[\], amount,
                  status, eob_id

  BillingEvent    event_id, tenant_id, module, event_type, actor_id,
                  count, timestamp, idempotency_key

  Invoice         invoice_id, tenant_id, period, platform_fee,
                  module_charges\[\], total, status, pdf_url, paid_at
  --------------- -------------------------------------------------------

**8. Technology Stack**

**8.1 Frontend**

  ------------------ ------------------ ----------------------------------
  **Layer**          **Technology**     **Rationale**

  Web App            Next.js 14 +       App Router, server components &
                     TypeScript         SSR for performance; type-safe;
                                        large ecosystem

  State Management   Zustand + TanStack Zustand for UI state; TanStack
                     Query              Query for server-state caching and
                                        sync within Next.js

  UI Component       shadcn/ui +        Accessible, unstyled components;
  Library            Tailwind CSS       utility-first CSS; dark mode
                                        support

  Mobile Apps        React Native +     Shares component logic and types
                     Expo               with Next.js web app; OTA updates;
                                        native iOS & Android

  Forms              React Hook Form +  Type-safe form validation;
                     Zod                schema-driven; minimal re-renders

  Charts / BI        Recharts + Apache  Recharts for in-app dashboards;
                     ECharts            ECharts for complex analytics

  Video (Telehealth) Daily.co SDK /     HIPAA-eligible video; WebRTC;
                     Twilio Video       waiting room support

  i18n               i18next            RTL support; namespace-based
                                        translations; lazy loading
  ------------------ ------------------ ----------------------------------

**8.2 Backend Services**

  ------------------ ------------------ ----------------------------------
  **Layer**          **Technology**     **Rationale**

  Core Services      NestJS 10 (Node.js Modular, decorator-based
                     20 LTS) +          architecture; DI containers;
                     TypeScript         shared types with Next.js frontend

  ML / AI Services   Python 3.12 +      FWA detection ML models; NLP for
                     FastAPI            clinical notes; drug interaction
                                        ML scoring

  API Framework      NestJS (primary) / Module/Controller/Provider
                     FastAPI (Python ML pattern; decorator-based routing;
                     services)          OpenAPI auto-generation via
                                        Swagger

  API Gateway        Kong OSS / AWS API Rate limiting; JWT validation;
                     GW                 tenant routing; request logging

  Event Bus          Apache Kafka       High-throughput; ordered per
                     (self-hosted on    partition; replay capability;
                     EC2)               exactly-once semantics

  Task Queue         BullMQ             Background jobs: invoice
                     (Redis-backed)     generation, report export, email
                                        batching

  WebSockets         Socket.io / AWS    Real-time queue updates, live
                     API GW WS          notifications, collaborative
                                        features

  FHIR Server        HAPI FHIR (Java)   Production-grade FHIR R4; REST +
                                        Subscription; validates against IG
                                        profiles
  ------------------ ------------------ ----------------------------------

**8.3 Data Storage**

  ------------------ ------------------ ----------------------------------
  **Purpose**        **Technology**     **Usage in HEP**

  Primary Database   PostgreSQL 16 on   All transactional data;
                     Amazon RDS         schema-per-tenant; ACID;
                     (Multi-AZ)         HIPAA-eligible; managed Multi-AZ
                                        failover & automated backups

  Full-Text Search   Elasticsearch 8    Patient search, drug search,
                                        clinical record search; per-tenant
                                        index

  Cache / Sessions   Redis 7            JWT session store; API response
                     (self-hosted on    cache; rate limit counters; BullMQ
                     EC2)               queues

  Time-Series Data   TimescaleDB        Vitals trends, usage metrics,
                     (Postgres ext.)    billing event timelines

  File / PHI         AWS S3 (HIPAA BAA) SOAP note PDFs, lab reports,
  Documents                             imaging, prescription records;
                                        server-side AES-256

  CDN                AWS CloudFront     Non-PHI static assets; UI bundles;
                                        public API docs

  Audit Log Store    Immutable S3 + AWS Tamper-evident audit trail;
                     WORM               Glacier Deep Archive after 90 days
  ------------------ ------------------ ----------------------------------

**8.4 Infrastructure & DevOps**

*The infrastructure is deliberately cost-optimised around two core AWS
services: Amazon RDS for PostgreSQL (managed, Multi-AZ) for all
transactional data, and EC2 Auto Scaling Groups for compute. All other
stateful components --- Kafka, Redis, and Elasticsearch --- run as
Docker containers on the EC2 fleet rather than as separate managed
services (MSK, ElastiCache, OpenSearch), removing premium per-service
overhead. S3 (for HIPAA-eligible PHI storage), the Application Load
Balancer, and ECR are retained as supporting AWS-native services.*

  ------------------ ------------------ ----------------------------------
  **Area**           **Technology**     **Details**

  Containerization   Docker + Docker    Each microservice packaged as a
                     Compose            Docker image; Compose for
                                        local/staging multi-container
                                        orchestration

  IaC                Terraform +        Terraform provisions EC2, RDS, VPC
                     Ansible            & networking; Ansible handles
                                        Docker host configuration &
                                        deployment

  CI/CD              GitHub Actions     Per-service pipelines: lint → test
                                        → build Docker image → scan → push
                                        to ECR → deploy to EC2

  Container Registry AWS ECR            Private Docker image registry;
                                        image scanning (Trivy); immutable
                                        tags; lifecycle policies

  Secret Management  AWS Secrets        Env secrets rotation; DB
                     Manager            credentials; API keys; FHIR
                                        signing keys

  Reverse Proxy / LB Nginx + AWS        mTLS termination; traffic routing
                     Application Load   between Docker containers across
                     Balancer           EC2 instances; canary rollouts

  Observability      Prometheus +       Metrics dashboards; log
                     Grafana + ELK      aggregation; distributed tracing
                                        (Jaeger); PagerDuty alerts

  DR / Backup        RDS Automated      RDS automated daily backups +
                     Backups + EBS      point-in-time recovery; EBS
                     Snapshots          snapshots for EC2 app/data
                                        volumes; cross-region copy; RTO \<
                                        4h, RPO \< 1h
  ------------------ ------------------ ----------------------------------

**8.5 Security & Compliance Stack**

  ------------------ ------------------ ----------------------------------
  **Requirement**    **Tool /           **Implementation**
                     Standard**         

  Identity & Auth    Keycloak +         Centralized IdP; PKCE flow for
                     OAuth2/OIDC        SPAs; hardware TOTP / FIDO2 MFA

  Encryption at rest AES-256 (EBS + S3) AWS KMS managed keys; RDS storage
                                        encryption for PostgreSQL;
                                        encrypted EBS volumes for EC2;
                                        column-level PHI encryption

  Encryption in      TLS 1.3            Enforced at ALB; HSTS; certificate
  transit                               management via ACM + Let\'s
                                        Encrypt

  Vulnerability      Trivy + Snyk +     Container image scanning;
  Scanning           OWASP ZAP          dependency audit; DAST in staging
                                        pipeline

  HIPAA Compliance   AWS HIPAA BAA      BAA covers EC2, RDS, EBS, S3,
                                        CloudWatch, KMS; documented
                                        controls

  GDPR               Data residency     Tenant region lock; data subject
                     controls           rights API (erasure, export);
                                        consent ledger

  SOC 2 Type II      Vanta (automation) Continuous compliance monitoring;
                                        evidence collection; annual audit

  Pen Testing        Quarterly          Bug bounty program; annual
                     (HackerOne)        third-party pen test; CVSS
                                        remediation SLA
  ------------------ ------------------ ----------------------------------

**8.6 Integration & Interoperability**

  ------------------ ------------------ ----------------------------------
  **Standard /       **Use Case**       **Implementation**
  Protocol**                            

  HL7 FHIR R4        Clinical data      HAPI FHIR server; RESTful FHIR
                     exchange           API; Subscription for real-time
                                        pushes

  NCPDP SCRIPT       E-prescribing      SurescriptsHQ gateway integration;
  2017071                               NewRx, RxChange, CancelRx messages

  X12 EDI            Insurance          Claim submission (837P/I),
  837/835/270/271    transactions       remittance (835), eligibility
                                        (270/271)

  NCPDP D.0          Pharmacy claims    Real-time pharmacy claim
                                        submission and adjudication via
                                        PBM network

  DICOM              Medical imaging    Orthanc DICOM server; web viewer
                                        (OHIF); DICOM SR for structured
                                        reports

  HL7 v2             Legacy lab / ADT   Mirth Connect integration engine;
                                        ADT A01/A08 events; ORU results

  SMART on FHIR      Third-party app    App launch framework; PKCE auth;
                     launch             patient context passing

  Stripe / Plaid     Payment processing Card payments (Stripe); ACH bank
                                        debit (Plaid); webhook
                                        reconciliation
  ------------------ ------------------ ----------------------------------

**9. Non-Functional Requirements**

  -------------- ----------------- ------------------ ----------------------
  **Category**   **Requirement**   **MVP Target**     **Year 2 Target**

  Performance    API p95 response  \< 500ms (read),   \< 300ms (read), \<
                 time              \< 1,000ms (write) 800ms (write)

  Performance    Page load time    \< 3s on 3G mobile \< 2s on 3G mobile

  Scalability    Concurrent users  10,000 sessions    50,000 sessions

  Scalability    Patient records   1M records with    10M+ records
                                   SLA met            

  Availability   Uptime SLA        99.5%              99.9%

  Availability   RTO / RPO         \< 4h / \< 1h      \< 1h / \< 15min

  Security       Encryption        AES-256 at rest,   Same + HSM key
                                   TLS 1.3 in transit management

  Security       MFA               Mandatory for all  Mandatory all roles
                                   clinical roles     

  Compliance     Certifications    HIPAA + GDPR       \+ SOC 2 Type II + ISO
                                                      27001

  Usability      Accessibility     WCAG 2.1 AA        All interfaces
                                   (patient portal)   

  Mobile         App platforms     Responsive PWA     Native iOS + Android
                                                      apps

  Billing        Metering accuracy \< 0.1% billing    \< 0.01%
                                   error rate         
  -------------- ----------------- ------------------ ----------------------

**10. MVP Roadmap --- First Launch Plan**

  -----------------------------------------------------------------------
  **MVP Timeline: 9 months to first paying tenant go-live. The MVP covers
  the Clinic + Doctor + Pharmacy modules with the core billing engine.
  Insurance and Patient Portal ship in Phases 2 and 3. Total MVP team:
  18--22 people.**

  -----------------------------------------------------------------------

**Team Structure for MVP**

  --------------------- ----------- ---------------------------------------
  **Role**              **Count**   **Responsibility**

  Product Manager       1           Feature prioritization, stakeholder
                                    alignment, sprint planning, roadmap
                                    ownership

  Tech Lead / Architect 1           Architecture decisions, code review,
                                    service design, cross-team technical
                                    alignment

  Backend Engineers     4           Core services: patient, EMR,
  (NestJS)                          scheduling, erx, pharmacy, billing

  Backend Engineer      1           FHIR server, drug interaction service,
  (Python)                          ML foundations

  Frontend Engineers    3           Clinic web app, Doctor web app,
  (Next.js)                         Pharmacy web app, shared component
                                    library

  Mobile Engineer       1           Patient portal mobile app (iOS +
  (React Native)                    Android)

  DevOps / Platform     2           Docker, EC2 fleet management, CI/CD
  Engineer                          pipelines, Terraform, monitoring,
                                    security baseline

  QA Engineer           2           Test planning, automation (Playwright +
                                    Jest), regression, HIPAA controls
                                    testing

  UI/UX Designer        2           Design system, user flows, wireframes,
                                    usability testing

  Compliance / Security 1           HIPAA BAA, audit trail verification,
                                    pen test coordination, SOC 2 prep
  --------------------- ----------- ---------------------------------------

**Phase 0 --- Foundation (Weeks 1--6)**

+-----------------------------------------------------------------------+
| **Phase 0 --- Platform Foundation · Weeks 1--6 · Team: 6 engineers +  |
| DevOps**                                                              |
|                                                                       |
| *Goal: All shared infrastructure live; first tenant can be            |
| provisioned end-to-end*                                               |
+-----------------------------------------------------------------------+

  ----------------------- ---------- ---------------------------------------
  **Deliverable**         **Week**   **Acceptance Criteria**

  **AWS environment setup W1--2      All resources provisioned via
  (VPC, EC2 fleet, RDS,              Terraform; staging + production EC2
  S3)**                              environments ready

  **CI/CD pipelines       W1--2      Pushes to main auto-deploy to staging;
  (GitHub Actions +                  manual gate to production
  ArgoCD)**                          

  **Multi-tenancy         W2--4      New tenant provisioned in \< 2 min;
  framework                          schema isolated; zero data leakage
  (schema-per-tenant)**              between tenants

  **Auth service          W2--4      Login, token refresh, MFA (TOTP)
  (OAuth2/OIDC, JWT,                 working; Keycloak integrated
  MFA)**                             

  **RBAC permission       W3--5      6 base roles defined; permission matrix
  system**                           enforced on all API endpoints

  **Audit trail service** W4--5      Every API mutation logged with
                                     user/action/IP/timestamp; immutable S3
                                     sink

  **Notification service  W4--6      Twilio SMS + SendGrid email; template
  (SMS + email)**                    engine; event triggers working

  **Super Admin portal    W5--6      Admin can create tenant, assign
  (tenant onboarding)**              modules, provision admin user;
                                     end-to-end tested

  **Billing metering      W5--6      Event emitter on Kafka; counter service
  foundation**                       consuming events; Redis aggregation
                                     working
  ----------------------- ---------- ---------------------------------------

**Phase 1 --- Clinic Module MVP (Weeks 7--16)**

+-----------------------------------------------------------------------+
| **Phase 1 --- Clinic Module · Weeks 7--16 · Team: 4 BE + 2 FE + 1     |
| QA**                                                                  |
|                                                                       |
| *Goal: First clinic tenant can register patients, schedule            |
| appointments, conduct consultations, and generate bills*              |
+-----------------------------------------------------------------------+

  --------------------- ---------- ---------------------------------------
  **Deliverable**       **Week**   **Acceptance Criteria**

  **Patient             W7--9      Online + walk-in registration;
  registration & MRN               duplicate detection; consent form
  service**                        storage

  **Basic EMR (SOAP     W8--11     Doctor can create, save, and sign SOAP
  notes, vitals,                   notes; vitals recorded; allergy list
  allergies,                       maintained
  medications)**                   

  **Appointment         W9--12     Booking, confirmation, cancellation;
  scheduling (single               SMS/email reminders firing correctly
  provider)**                      

  **ICD-10/11 diagnosis W10--12    Typeahead search returning correct
  coding (inline                   codes; selected codes saved to
  search)**                        encounter

  **Lab result upload   W11--13    Pharmacist can attach PDF lab results
  (PDF attachment)**               to patient record; viewable by doctor

  **Referral generation W12--14    Doctor can generate internal referral
  (internal)**                     letter; routes to receiving doctor\'s
                                   queue

  **Encounter billing   W13--16    CPT/ICD mapped to invoice; insurance
  (cash + insurance)**             eligibility check; EDI 837 claim
                                   generated

  **Payment collection  W14--16    Stripe integration; payment recorded;
  (card + cash)**                  receipt emailed to patient

  **Basic clinic        W15--16    Appointments today, revenue this
  analytics dashboard**            week/month; provider utilisation
  --------------------- ---------- ---------------------------------------

**Phase 2 --- Doctor Module MVP (Weeks 13--20)**

+-----------------------------------------------------------------------+
| **Phase 2 --- Doctor Module · Weeks 13--20 (parallel with Phase 1     |
| tail) · Team: 3 BE + 1.5 FE + 1 QA**                                  |
|                                                                       |
| *Goal: Doctor can conduct consultations, write notes, e-prescribe,    |
| and make referrals independently of clinic if needed*                 |
+-----------------------------------------------------------------------+

  --------------------- ---------- ---------------------------------------
  **Deliverable**       **Week**   **Acceptance Criteria**

  **Doctor dashboard**  W13--15    Schedule, pending actions, critical
                                   alerts all populated in real time

  **SOAP note editor    W14--16    Sections (S/O/A/P) with free text;
  (structured)**                   ICD-10 inline; save as draft /
                                   finalise + sign

  **Drug database       W15--17    Drug lookup (brand + generic); dosage
  integration**                    calculator; drug monograph display

  **Drug-drug           W16--18    Interaction check on add; Major alert
  interaction engine               blocks prescription; override with
  (Major severity)**               justification

  **Drug-allergy        W16--18    Cross-references patient allergy
  contraindication                 registry; hard block on
  check**                          life-threatening match

  **E-prescription      W17--19    Rx written → routed to pharmacy via
  transmission**                   erx-service → Kafka event; pharmacy
                                   receives

  **Medical certificate W18--19    Sick leave, fitness-to-work; PDF
  generation**                     generated with doctor signature block

  **Clinic ↔ Doctor     W19--20    Doctor notes sync to Clinic EMR;
  integration flows**              billing reads ICD codes from notes
  --------------------- ---------- ---------------------------------------

**Phase 3 --- Pharmacy Module MVP (Weeks 18--26)**

+-----------------------------------------------------------------------+
| **Phase 3 --- Pharmacy Module · Weeks 18--26 · Team: 3 BE + 1.5 FE +  |
| 1 QA**                                                                |
|                                                                       |
| *Goal: Pharmacist can receive e-prescriptions, complete dispensing    |
| workflow, manage stock, and submit claims*                            |
+-----------------------------------------------------------------------+

  --------------------- ---------- ---------------------------------------
  **Deliverable**       **Week**   **Acceptance Criteria**

  **E-prescription      W18--20    Rx received from erx-service; appears
  intake (from Doctor              in pharmacy queue; prescriber verified
  module)**                        

  **Manual Rx entry     W19--21    Pharmacist types paper Rx; validation
  (paper Rx)**                     against drug DB; DEA schedule flag

  **7-step dispensing   W20--23    Checklist UI; each step recorded with
  workflow**                       timestamp; counselling checkbox
                                   required

  **Drug interaction    W21--23    Same engine as Doctor module;
  check at dispensing**            additional check at point of dispense

  **Dispensing label    W22--24    Label PDF with drug name, dose,
  generation**                     instructions, patient name, dispensing
                                   pharmacist

  **Inventory           W22--25    Stock decremented on dispense; expiry
  management (real-time            alerts at 30/60/90 days; reorder flag
  stock,                           
  batch/expiry)**                  

  **Pharmacy claim      W24--26    Claim generated on bill; submitted to
  submission (NCPDP                PBM; adjudication status received
  D.0)**                           

  **Billing event       W24--26    BillingEvent emitted on bill
  metering (per bill               finalisation; billing-service
  generated)**                     aggregates for invoice

  **Refill reminder     W25--26    Scheduled SMS 7 days before refill due;
  SMS**                            opt-out handling
  --------------------- ---------- ---------------------------------------

**Phase 4 --- MVP Hardening & First Launch (Weeks 24--36)**

+-----------------------------------------------------------------------+
| **Phase 4 --- Hardening & Launch · Weeks 24--36 · Team: Full team**   |
|                                                                       |
| *Goal: Production-ready platform; first 3 paying tenants live; all    |
| billing flows operational*                                            |
+-----------------------------------------------------------------------+

  ---------------------------- ---------- ---------------------------------------
  **Deliverable**              **Week**   **Acceptance Criteria**

  **End-to-end integration     W24--27    All cross-module flows tested: e-Rx
  testing                                 routing, note sync, billing event chain
  (Clinic+Doctor+Pharmacy)**              

  **Performance testing &      W26--29    Load test to 5,000 concurrent users;
  optimisation**                          all p95 targets met; bottlenecks
                                          resolved

  **HIPAA security audit & pen W27--30    Third-party pen test completed; all
  test**                                  Critical/High findings resolved before
                                          launch

  **Billing engine: invoice    W28--31    Full invoice cycle tested: metering →
  generation + Stripe                     invoice → email → payment → receipt
  payment**                               

  **Onboarding fee collection  W29--31    Stripe checkout for onboarding fee;
  (one-time payment)**                    signed contract webhook triggers tenant
                                          provisioning

  **Patient portal MVP         W30--34    Patient can register, book appointment,
  (booking + records +                    view notes, pay bill --- end-to-end
  payment)**                              

  **Pilot tenant onboarding (3 W32--35    3 real clinics + pharmacies onboarded;
  tenants)**                              hypercare support; feedback collected

  **Bug bash & launch          W35--36    All P0/P1 bugs fixed; runbook complete;
  readiness review**                      on-call rota established; launch
                                          approved
  ---------------------------- ---------- ---------------------------------------

**10.1 Post-MVP Enhancement Roadmap**

+--------+-----------------+-------------------------------------------+
| **P    | **Timeline**    | **Features**                              |
| hase** |                 |                                           |
+--------+-----------------+-------------------------------------------+
| *      | Months 10--13   | -   Insurance module (policy admin, prior |
| *Phase |                 |     auth, claims adjudication, EFT        |
| 5**    |                 |     payments)                             |
|        |                 |                                           |
|        |                 | -   Clinic: multi-provider scheduling,    |
|        |                 |     DICOM radiology viewer, LIS           |
|        |                 |     integration                           |
|        |                 |                                           |
|        |                 | -   Doctor: formulary check,              |
|        |                 |     Moderate/Minor interaction alerts,    |
|        |                 |     external referrals                    |
+--------+-----------------+-------------------------------------------+
| *      | Months 13--17   | -   Telemedicine (HD video consult, async |
| *Phase |                 |     consultation, session recording)      |
| 6**    |                 |                                           |
|        |                 | -   Doctor: voice-to-text SOAP notes,     |
|        |                 |     specialty templates, controlled       |
|        |                 |     substance Rx                          |
|        |                 |                                           |
|        |                 | -   Pharmacy: multi-branch inventory,     |
|        |                 |     cold chain IoT, PDMP, auto-reorder    |
+--------+-----------------+-------------------------------------------+
| *      | Months 17--21   | -   Patient portal: family accounts, PHR  |
| *Phase |                 |     export, immunisation records, health  |
| 7**    |                 |     education                             |
|        |                 |                                           |
|        |                 | -   Insurance: FWA ML detection, HEDIS    |
|        |                 |     reporting, IRO integration, OCR paper |
|        |                 |     claims                                |
|        |                 |                                           |
|        |                 | -   Platform: ABAC fine-grained policies, |
|        |                 |     SSO/SAML, SMART on FHIR app gallery   |
+--------+-----------------+-------------------------------------------+
| *      | Months 21--24   | -   Advanced BI: ad-hoc query builder,    |
| *Phase |                 |     cross-tenant anonymised analytics,    |
| 8**    |                 |     predictive dashboards                 |
|        |                 |                                           |
|        |                 | -   Biometric device integration          |
|        |                 |     (glucometer, BP monitor via           |
|        |                 |     Bluetooth/IoT)                        |
|        |                 |                                           |
|        |                 | -   International expansion:              |
|        |                 |     multi-currency, RTL languages,        |
|        |                 |     jurisdiction-specific compliance      |
|        |                 |     packs                                 |
+--------+-----------------+-------------------------------------------+

**11. Risks, Assumptions & Constraints**

**11.1 Risk Register**

  ------------------- ---------------- ------------ ----------------------------------
  **Risk**            **Likelihood**   **Impact**   **Mitigation**

  PHI data breach     Low              Critical     AES-256, TLS 1.3, MFA, pen testing
                                                    quarterly, incident response plan,
                                                    cyber insurance

  Payer API           High             High         Parallel EDI file-based fallback;
  integration delays                                stub payer for MVP testing;
                                                    dedicated integration sprint

  Regulatory          Medium           High         Dedicated compliance officer;
  non-compliance                                    legal review per market; Vanta
                                                    continuous monitoring

  Billing metering    Medium           High         Idempotency keys on all events;
  inaccuracy                                        reconciliation job nightly;
                                                    dispute handling SLA

  Low provider        Medium           Medium       Phased pilot with 3 clinics;
  adoption                                          hands-on onboarding; training; ROI
                                                    case study at Month 6

  Scalability         Low              High         Load test at each phase gate; HPA
  bottlenecks                                       auto-scaling; read replicas; Redis
                                                    caching

  Drug database       Medium           Medium       Evaluate First Databank, Multum,
  licensing                                         Wolters Kluwer; budget in Year 1
                                                    opex

  HIPAA BAA for all   Medium           Critical     Vendor checklist; BAA signed
  vendors                                           before integration; prefer
                                                    AWS-native services
  ------------------- ---------------- ------------ ----------------------------------

**11.2 Assumptions**

-   All tenants have stable internet connectivity (minimum 5 Mbps
    broadband)

-   At least one insurance payer provides a sandbox API for integration
    testing before production

-   Target market has a legal framework permitting e-prescribing and
    electronic consent

-   Drug database vendor (e.g. First Databank or Multum) provides a
    commercial license within Month 2

-   A pilot pharmacy is available for closed beta testing from Month 5
    onward

-   Patient data consent to share health records cross-tenant is
    explicit, auditable, and revocable

**11.3 Constraints**

-   Controlled substance e-prescribing (Schedule II) requires DEA
    certification --- deferred to Phase 6

-   DICOM full image viewing requires radiologist software licensing
    agreement --- deferred to Phase 5

-   International expansion (non-US markets) requires
    jurisdiction-specific compliance sprints

-   HIPAA BAA required from every cloud vendor storing or processing PHI
    before integration

**12. Glossary**

  --------------- -------------------------------------------------------
  **Term**        **Definition**

  HEP             Healthcare Ecosystem Platform --- the product described
                  in this document

  EMR / EHR       Electronic Medical / Health Record --- digital patient
                  health chart

  FHIR R4         Fast Healthcare Interoperability Resources R4 --- HL7
                  standard for health data exchange

  HIPAA           Health Insurance Portability and Accountability Act ---
                  US healthcare data privacy law

  PHI             Protected Health Information --- individually
                  identifiable health data

  RBAC / ABAC     Role-Based / Attribute-Based Access Control ---
                  permission models

  ICD-10/11       International Classification of Diseases --- standard
                  diagnosis coding system

  CPT             Current Procedural Terminology --- medical procedure
                  billing codes

  NCPDP D.0       National Council for Prescription Drug Programs ---
                  pharmacy claim standard

  EDI 837 / 835   X12 electronic formats for insurance claim submission /
                  payment remittance

  CQRS            Command Query Responsibility Segregation ---
                  architecture pattern separating read/write paths

  MRN             Medical Record Number --- unique patient identifier
                  within a tenant

  FWA             Fraud, Waste and Abuse --- improper billing and claims
                  activities

  EOB             Explanation of Benefits --- document explaining
                  insurance claim payment details

  RTO / RPO       Recovery Time / Point Objective --- disaster recovery
                  targets

  PBM             Pharmacy Benefit Manager --- manages prescription drug
                  benefits for insurers

  PDMP            Prescription Drug Monitoring Program --- state-level
                  controlled substance tracking

  ASG             Auto Scaling Group --- AWS EC2 fleet auto-scaling based
                  on CPU/memory/request load

  MTM             Medication Therapy Management --- pharmacist-led
                  medication review service

  MVP             Minimum Viable Product --- smallest feature set
                  delivering core value at launch
  --------------- -------------------------------------------------------

*Healthcare Ecosystem Platform --- Single Source of Truth v1.0 \|
Confidential --- Internal Use Only*

All rights reserved. Do not distribute without authorization.
