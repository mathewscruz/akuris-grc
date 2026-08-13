DO $$
DECLARE
  fw uuid := '420b88c8-4771-4993-af39-b57278037d63';
  r record;
  data jsonb := '[
  ["CC1.1","Common Criteria","Integrity and Ethical Values","The entity demonstrates a commitment to integrity and ethical values"],
  ["CC1.2","Security - Governance","Governance Structure","The board of directors oversees the entity''s business strategy and risks"],
  ["CC1.3","Security - Governance","Oversight Responsibility","Management establishes appropriate structures, reporting lines and authorities"],
  ["CC1.4","Security - Governance","Commitment to Competence","The entity demonstrates a commitment to attract, develop and retain competent individuals"],
  ["CC1.5","Security - Governance","Accountability","The entity holds individuals accountable for their internal control responsibilities"],
  ["CC2.1","Security - Risk Management","Risk Assessment","The entity specifies objectives with sufficient clarity to enable the identification of risks"],
  ["CC2.2","Security - Risk Management","Risk Identification","The entity identifies risks to its objectives and analyzes them to determine how they should be managed"],
  ["CC2.3","Security - Risk Management","Fraud Risk Assessment","The entity considers the potential for fraud in assessing risks"],
  ["CC3.1","Security - Control Activities","Policies and Procedures","The entity specifies control objectives with sufficient clarity"],
  ["CC3.2","Security - Control Activities","Control Monitoring","The entity establishes control activities over technology"],
  ["CC3.3","Security - Control Activities","Segregation of Duties","The entity deploys control activities through policies and procedures"],
  ["CC4.1","Security - Information","Information Communication","The entity obtains or generates quality information to support internal control"],
  ["CC4.2","Security - Information","Internal Communication","The entity internally communicates information necessary to support internal control"],
  ["CC5.1","Security - Monitoring","Selection and Development of Controls","The entity selects, develops and performs ongoing and/or separate evaluations"],
  ["CC5.2","Security - Monitoring","Communication of Deficiencies","The entity evaluates and communicates control deficiencies in a timely manner"],
  ["CC6.1","Security - Security","Logical and Physical Access Control","The entity implements logical and physical access controls"],
  ["CC6.2","Security - Security","Authentication","Prior to issuing system credentials, the entity registers and authorizes new users"],
  ["CC6.3","Security - Security","Access Management","The entity authorizes, modifies or removes access based on authorizations"],
  ["CC7.1","Security - Detection","Threat Detection","The entity uses detection mechanisms to identify anomalies"],
  ["CC7.2","Security - Detection","Incident Response","The entity responds to security incidents in a timely manner"],
  ["CC8.1","Security - Change Management","Change Management","The entity authorizes, designs, develops and tests system changes"],
  ["A1.1","Availability","Capacity and Performance","The entity maintains, monitors and evaluates capacity and performance"],
  ["A1.2","Availability","System Monitoring","The entity monitors infrastructure, software and backup components"],
  ["A1.3","Availability","Failure Recovery","The entity implements recovery and backup plans"],
  ["A2.1","Availability","Business Continuity Plan","The entity develops and documents business continuity plans"],
  ["A2.2","Availability","Continuity Testing","The entity periodically tests continuity plans"],
  ["A3.1","Availability","Redundancy","The entity implements redundancy controls for critical components"],
  ["A3.2","Availability","Backup Sites","The entity maintains alternate processing sites"],
  ["A4.1","Availability","SLA - Service Level Agreements","The entity defines and communicates SLAs with customers"],
  ["A4.2","Availability","SLA Monitoring","The entity monitors and reports SLA compliance"],
  ["A5.1","Availability","Availability Incident Management","The entity responds to and manages availability incidents"],
  ["PI1.1","Processing Integrity","Processing Quality","The entity obtains or generates quality information"],
  ["PI1.2","Processing Integrity","Input Validation","The entity validates input data for completeness, accuracy and validity"],
  ["PI1.3","Processing Integrity","Complete Processing","The entity processes data completely and accurately"],
  ["PI1.4","Processing Integrity","Output Validation","The entity validates output data before distribution"],
  ["PI1.5","Processing Integrity","Processing Reconciliation","The entity reconciles processed data with source records"],
  ["PI2.1","Processing Integrity","Transaction Authorization","The entity authorizes transactions before processing"],
  ["PI2.2","Processing Integrity","Processing Logs","The entity logs processing activities"],
  ["PI3.1","Processing Integrity","Error Handling","The entity identifies and handles processing errors"],
  ["PI3.2","Processing Integrity","Error Correction","The entity corrects identified errors in a timely manner"],
  ["PI4.1","Processing Integrity","System Interfaces","The entity implements controls over interfaces between systems"],
  ["C1.1","Confidentiality","Identification of Confidential Information","The entity identifies and classifies confidential information"],
  ["C1.2","Confidentiality","Information Disposal","The entity disposes of confidential information securely"],
  ["C2.1","Confidentiality","Confidential Access Controls","The entity restricts logical and physical access to confidential information"],
  ["C2.2","Confidentiality","Data Encryption","The entity protects confidential information in transit and at rest"],
  ["C3.1","Confidentiality","NDAs - Confidentiality Agreements","The entity obtains confidentiality agreements with external parties"],
  ["C3.2","Confidentiality","Confidentiality Training","The entity trains personnel on confidentiality policies"],
  ["C4.1","Confidentiality","Breach Monitoring","The entity monitors confidentiality breaches"],
  ["C4.2","Confidentiality","Breach Response","The entity responds to confidentiality breaches"],
  ["P1.1","Privacy","Privacy Notice","The entity provides notice about its privacy practices"],
  ["P2.1","Privacy","Choice and Consent","The entity communicates available choices and obtains consent"],
  ["P3.1","Privacy","Data Collection","The entity collects personal information limited to identified purposes"],
  ["P3.2","Privacy","Use Limitation","The entity uses personal information only for identified purposes"],
  ["P4.1","Privacy","Data Retention","The entity retains personal information only as long as necessary"],
  ["P4.2","Privacy","Personal Data Disposal","The entity disposes of personal information securely"],
  ["P5.1","Privacy","Data Access","The entity provides individuals with access to their personal data"],
  ["P5.2","Privacy","Data Correction","The entity corrects inaccurate personal information"],
  ["P6.1","Privacy","Third-Party Disclosure","The entity discloses personal information to third parties with consent"],
  ["P6.2","Privacy","Third-Party Agreements","The entity obtains third-party commitments on data protection"],
  ["P7.1","Privacy","Data Quality","The entity maintains accurate and complete personal information"],
  ["P8.1","Privacy","Compliance Monitoring","The entity monitors compliance with privacy policies"],
  ["P8.2","Privacy","Privacy Incidents","The entity responds to privacy complaints and incidents"],
  ["P9.1","Privacy","International Transfers","The entity obtains consent for international transfers"]
]'::jsonb;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(data) AS e(v) LOOP
    UPDATE public.gap_analysis_requirements
       SET codigo = codigo,
           titulo_en = r.v->>2,
           descricao_en = r.v->>3,
           categoria_en = r.v->>1
     WHERE framework_id = fw AND codigo = r.v->>0;
  END LOOP;
END $$;

UPDATE public.gap_analysis_frameworks
   SET nome_en = 'SOC 2 Type II',
       descricao_en = 'AICPA Trust Services Criteria for Security, Availability, Processing Integrity, Confidentiality and Privacy'
 WHERE id = '420b88c8-4771-4993-af39-b57278037d63';