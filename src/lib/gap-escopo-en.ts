/**
 * The scope assistant, in English.
 *
 * ## Why this text lives here and not in `src/i18n`
 *
 * These are not labels. `justificativa` is the sentence written into the
 * Statement of Applicability and signed by the customer — it asserts facts
 * about their company ("all personnel work from private residences") and an
 * auditor reads it. Two consequences:
 *
 *  · It must never fall back. `t()` humanises a missing key into something
 *    that looks like a sentence; a humanised key inside a compliance document
 *    is worse than an obvious gap. Here a missing translation is a type error
 *    and a failing test (`escopo-fala-ingles.test.ts`), never silent prose.
 *
 *  · It must be findable. When a lawyer reviews the English wording, they read
 *    one file, side by side with `gap-escopo.ts`, instead of hunting keys.
 *
 * Portuguese stays the source of truth in `gap-escopo.ts`; this file mirrors it
 * by question id. Adding a question there without adding it here fails the test
 * instead of shipping a Portuguese question to an English screen — which is
 * exactly what happened before this file existed.
 *
 * Spelling is US English, matching the `en` locale (`en-US`) the app already
 * formats dates and numbers with.
 */

/** The translatable half of a question. `codigos` are language-independent. */
export interface TextoDePerguntaEmIngles {
  pergunta: string;
  ajuda: string;
  justificativa: string;
  nuncaExcluir?: string;
  aviso?: string;
}

export interface EscopoEmIngles {
  /** `{n}` is replaced with the real number of questions. */
  intro: string;
  perguntas: Record<string, TextoDePerguntaEmIngles>;
  /** Keyed `origem>alvo`, matching `TravaDeEscopo.se[0]` and `.entao[0]`. */
  travas?: Record<string, string>;
}

export const ESCOPO_EN: Record<string, EscopoEmIngles> = {
  iso27001: {
    intro:
      'These {n} questions describe how your company actually works — where people work, what equipment exists and who writes the systems. Every "no" takes off your list the Annex A controls that have no object in your reality, with the justification already written for the auditor to read. The management requirements in clauses 4 to 10 never leave, because the standard allows no exclusion there.',
    perguntas: {
      instalacoes_proprias: {
        pergunta:
          'Does the company occupy any physical address where people work, such as an office, a shop, a warehouse, a factory or a room in a coworking space?',
        ajuda:
          'Answer yes if there is any space the company owns, rents or uses exclusively, even a small room, and answer no only if everyone works from home and the company keeps no address at all.',
        justificativa:
          "The organization neither occupies nor controls any physical facility. All personnel work from private residences and all information processing takes place in services contracted over the internet. There are no perimeters, rooms, entrances, building support utilities or cabling under the organization's responsibility to be protected. Physical security of the environments where information is processed is a contractual obligation of the providers and is addressed in A.5.19, A.5.22 and A.5.23; protection of equipment and information off premises is addressed in A.6.7, A.7.9 and A.8.1. This condition will be reassessed should the organization come to occupy any address.",
        nuncaExcluir:
          'Even with no office, A.7.5, A.7.7, A.7.8, A.7.9, A.7.10, A.7.13 and A.7.14 stay in scope, because the company remains responsible for the equipment it hands to people, for the clear desk and clear screen rule in home working, for storage media and for the secure disposal of that equipment.',
      },
      area_de_acesso_restrito: {
        pergunta:
          'Is there any space inside the company that only some people may enter, such as a server room, a network room, a locked archive, a safe or a restricted room?',
        ajuda:
          'Any environment whose access is limited by key, badge or code counts, including a small room holding the network rack, and if every employee can move through the whole space the answer is no.',
        justificativa:
          'The organization has no secure areas. Its facilities consist of a single office space, accessible to all employees authorized to enter the premises, with no server room, technical room, safe or restricted archive. With no secure area defined, there is no working in secure areas to be regulated. Control over who enters and moves through the facilities remains applicable and is addressed in A.7.1, A.7.2, A.7.3 and A.7.4.',
        nuncaExcluir:
          'Having no restricted room does not remove the duty to control who enters the office: A.7.1, A.7.2, A.7.3 and A.7.4 stay in scope for as long as the company occupies any address.',
      },
      cabeamento_ou_equipamento_no_escritorio: {
        pergunta:
          'Is there any network cable, rack, switch, router, server, storage array, UPS or phone system installed by the company at the office?',
        ajuda:
          'Look under the desks and in the network cabinet: if people connect their computers by cable, or if any company equipment stays powered on around the clock, answer yes, and answer no only if everything runs over the building wireless network and there are only laptops.',
        justificativa:
          "The organization has not installed and does not operate data or power cabling of its own in the facilities it occupies. Employees use laptops connected over a wireless network supplied and maintained by the building's landlord, and there are no racks, network equipment, servers or dedicated lines under the organization's responsibility. Protection of the building cabling is the landlord's obligation and is monitored as a supplier service under A.5.19 and A.5.22.",
        nuncaExcluir:
          'A.7.11 stays in scope even with no equipment of your own, because operations still depend on the building power and internet, and the standard expects the company to assess the effect of losing those utilities.',
      },
      trabalho_fora_das_instalacoes: {
        pergunta:
          'Does anyone work outside the office at any time, at home, at a client site or while traveling, carrying a laptop, a phone or company documents?',
        ajuda:
          'A single occasional case makes the answer yes, such as the director who opens email on their phone at the weekend or the salesperson who takes a laptop to a client.',
        justificativa:
          'The organization does not practice remote working in any form and no information asset leaves its facilities. All work is performed on site, on fixed equipment that remains in the office, with no remote access to systems and no use of corporate or personal mobile devices for work purposes. With no activity outside the facilities and no assets beyond the perimeter, there is nothing for these controls to regulate. Authorizing any remote work, however occasional, will reactivate both controls.',
        nuncaExcluir:
          'A.8.1 and A.7.7 remain applicable, because the computers inside the office are still end user devices and the clear desk and clear screen rule applies equally to on-site work.',
      },
      servicos_em_nuvem: {
        pergunta:
          'Does the company use any internet service to store files, exchange email or run systems, such as Google Workspace, Microsoft 365, Dropbox, an online ERP, an HR system or an accounting system?',
        ajuda:
          'If the system is reached through a browser and the company pays a monthly fee, instead of installing the program on a server of its own, that is a cloud service and the answer is yes.',
        justificativa:
          "The organization does not use cloud services. All systems, electronic mail and files run and are stored on infrastructure of its own, installed and operated at the organization's facilities, with no third-party processing or storage contracted over the internet. Engaging any cloud service will go through the acquisition process and will make this control applicable again.",
        nuncaExcluir:
          'A.5.19, A.5.20, A.5.21 and A.5.22 stay in scope, because even with no cloud the company buys equipment, software and support from suppliers, and those contracts need security requirements.',
      },
      desenvolvimento_interno: {
        pergunta:
          'Does anyone working at the company write or change program code, such as the website, an application, an integration between systems or an automation?',
        ajuda:
          'It is yes if there is any person, even one and even part time, who programs for the company, including scripts, spreadsheet macros and screens built in low-code tools.',
        justificativa:
          'The organization does not develop software in house. There are no programming, system architecture definition or coding activities performed by its own personnel, and the organization uses systems acquired from third parties. Security requirements for the software the organization uses are established in the acquisition process and in supplier contracts, addressed in A.5.19 to A.5.22, and any development contracted out is addressed in A.8.30. Hiring development personnel will make these controls applicable again.',
        nuncaExcluir:
          'A.8.26, A.8.29, A.8.31, A.8.32 and A.8.33 do not leave on this answer, because they apply to off-the-shelf systems too: the company still defines what it requires of the software, accepts new versions, separates environments and controls changes.',
      },
      codigo_fonte_proprio: {
        pergunta:
          'Does the company hold the source code of any system anywhere, whether written by it or delivered by a supplier?',
        ajuda:
          'Source code is the text of the program, usually kept in tools such as GitHub, GitLab, Bitbucket or Azure DevOps, or in a network folder, and if the company only receives programs ready to install or use the answer is no.',
        justificativa:
          "The organization holds no source code for any system. It does not develop software and does not receive source code from its suppliers, who deliver executable software or services accessed over the internet. With no repository, library or copy of source code under the organization's control, there is no source code access to restrict. Receiving source code from a supplier, including under an escrow clause, will make this control applicable again.",
        nuncaExcluir:
          'A.8.2 and A.8.3 stay in scope, because restricting access to information and controlling privileged accounts apply to every system, including those bought off the shelf.',
      },
      desenvolvimento_terceirizado: {
        pergunta:
          'Does the company pay any person or firm outside it to build, customize or maintain a system made to order for it?',
        ajuda:
          'This includes a software house, the agency that built the website, a freelance developer and the vendor that customizes the ERP, and buying an off-the-shelf system with no changes written for the company does not count.',
        justificativa:
          'The organization does not contract software development to third parties. There are no systems built to order for the organization and no customizations programmed by suppliers: every system in use is a standard market product, acquired as a license or as a service, with no change of code. With no outsourced development, there is no development activity to direct, monitor and review. The relationship with the suppliers of those products is addressed in A.5.19 to A.5.22.',
        nuncaExcluir:
          'A.5.19, A.5.20, A.5.21 and A.5.22 never leave on this answer, because whoever supplies the off-the-shelf system is still a supplier with access to company information.',
      },
      copia_dados_para_teste: {
        pergunta:
          'Does the company copy real information from live systems into test, training or demonstration environments?',
        ajuda:
          'Think of database copies used to test an update, a staging environment holding real customer data, or a training database built from the live one, and if none of that happens the answer is no.',
        justificativa:
          'The organization does not use test information. It maintains no test, staging, training or demonstration environments populated with data, and does not copy operational information for testing purposes. With no test information in existence, there is no selection, protection or control of such information to perform. Creating any environment with data for testing will make this control applicable again.',
        nuncaExcluir:
          'A.8.31 and A.8.32 stay in scope, because changes to production systems must be controlled even with no test environment, and the auditor will want to see how an update is approved before it goes live.',
      },
    },
    travas: {
      'instalacoes_proprias>trabalho_fora_das_instalacoes':
        'If nobody has an office, then everybody works outside one.',
      'instalacoes_proprias>servicos_em_nuvem':
        'With no office and no cloud, the company would have nowhere to keep anything.',
      'desenvolvimento_interno>codigo_fonte_proprio':
        'Whoever writes code has source code kept somewhere.',
    },
  },

  lgpd: {
    intro:
      'The LGPD is Brazilian law and almost all of it applies to your company: these {n} questions single out only the articles that exist for whoever carries out one specific kind of processing, and every NO comes with the written justification the auditor will read in your statement of applicability.',
    perguntas: {
      dados_de_menores_de_18: {
        pergunta: 'Does the company hold data about anyone under 18?',
        ajuda:
          "Answer YES if the employee health plan or life insurance covers children, if the company asks for dependants' data for income tax, if it has an underage intern or apprentice, or if any customer, student or website visitor could be under 18. If none of that happens, answer NO.",
        justificativa:
          'The organization carries out no processing of personal data of children or adolescents. No product, service, service channel or internal process is directed at persons under 18, and the benefits granted to employees do not cover underage dependants. There is therefore no processing to be carried out in the best interest of the minor, and no specific and highlighted consent from a parent or legal guardian to be collected and demonstrated. This article will return to scope should the organization come to process data of minors, in which case the assessment will be redone before processing begins.',
        nuncaExcluir:
          "Answering NO here does not take consent in general (Art. 8), withdrawal of consent (Art. 9) or sensitive data (Art. 11) out of scope. Note: an employee's child on the health plan is already a child's data. When in doubt, answer YES.",
      },
      dados_guardados_fora_do_brasil: {
        pergunta: 'Is any personal data stored outside Brazil or sent to another country?',
        ajuda:
          'Almost every company answers YES. Count YES if you use Gmail, Google Workspace, Microsoft 365, Outlook, Dropbox, AWS, Azure, Salesforce, HubSpot, Slack, ChatGPT or any system from a foreign company; if you keep backups in the cloud; or if you send a spreadsheet with employee or customer names to a head office, branch, partner or supplier in another country. Answer NO only if every system and server sits in Brazil and no data leaves the country.',
        justificativa:
          'The organization carries out no international transfer of personal data. All processing takes place in Brazilian territory, on systems and infrastructure contracted from domestic suppliers, with no transmission, remote access or storage of personal data abroad and no sharing with a head office, branch, partner or associate based in another country. There is therefore no transfer scenario to be classified, no destination country whose level of protection must be assessed, no specific or standard contractual clauses to be entered into, and no international cooperation mechanism to be invoked. These articles return to scope, assessed before any engagement, should the organization come to contract a service that stores or accesses personal data outside Brazil.',
        nuncaExcluir:
          "Even with everything in Brazil, the security duties (Art. 46 and Art. 49), the responsibility over the supplier that processes data on the company's behalf (Art. 39 and Art. 44) and the record of those operations (Art. 37) remain mandatory. If the company uses Google or Microsoft email, the answer is YES.",
      },
      decisao_automatica_sobre_pessoas: {
        pergunta:
          'Does any company system decide something about a person on its own, with nobody reviewing it?',
        ajuda:
          'Examples of YES: a system that approves or denies credit, a limit or an installment plan; a site that calculates a different price or discount for each customer; a recruiting tool that discards applications automatically; anti-fraud that blocks an account or a purchase on the spot; a system that scores customers and treats each band differently. If a person always reviews and approves before the decision takes effect, answer NO.',
        justificativa:
          "The organization does not take decisions based solely on automated processing of personal data. Every decision affecting data subjects' interests, including credit approval, candidate selection, pricing, access blocking and refusal of service, is reviewed and approved by a natural person before it takes effect, and the systems used only support that review. There is therefore no automated decision open to a request for review by the data subject, and no personal, professional, consumer or credit profile defined exclusively by a system. This article returns to scope should the organization deploy any automation whose final decision is taken with no human intervention.",
        nuncaExcluir:
          'This does not take the other data subject rights (Art. 18), confirmation and access within 15 days (Art. 19) or portability (Art. 20) out of scope. A system that only suggests, with a person approving, is NO; a system that already blocks, already refuses or already removes is YES.',
      },
      vinculo_com_o_setor_publico: {
        pergunta:
          'Is the company part of the public sector, or does it receive personal records handed over by a public body?',
        ajuda:
          'Answer YES if the company is a government body, an autarchy, a public foundation, a state-owned company or a mixed-capital company; or if it receives lists and databases with personal data handed over by a city hall, a state government, a ministry or an autarchy, through an agreement, a contract or participation in a social program. Sending data to the government because the law requires it, such as eSocial, the Federal Revenue Service, Caged or invoices, does NOT count here and does not change the answer. Providing services to the government does not count either, as long as the company receives no personal records from the body.',
        justificativa:
          'The organization is a private legal entity and does not form part of the direct or indirect public administration. It does not receive personal databases from public bodies or entities through agreements, administrative contracts or participation in government programs, and it does not engage in shared use of personal data in the execution of public policies. For that reason the following are not required of it: shared use of data by the public authorities, bound to specific public policy purposes and to the legal remit of public bodies (Art. 26), and notification to the National Data Protection Authority of the communication or shared use of data from a public law entity to a private law entity (Art. 27). Should the organization enter into an agreement or contract involving the transfer of personal databases by a public entity, these articles will return to scope.',
        nuncaExcluir:
          'The impact assessment that the ANPD may require of any private controller (Art. 32 and Art. 38) stays in scope and does not leave on this question. Note: in the system, the titles of these four articles are swapped relative to the text they describe, so check the description before confirming the exclusion.',
      },
      atuacao_em_saude_ou_pesquisa: {
        pergunta:
          'Is the company in healthcare, or does it carry out scientific research using personal data?',
        ajuda:
          'Answer YES if the company is a hospital, a clinic, a laboratory, a health plan operator, a pharmaceutical company, a medical device manufacturer, a university or a research institute, or if it takes part in clinical and epidemiological studies. Offering a health plan to employees does not make a company a healthcare company: in that case, answer NO.',
        justificativa:
          'The organization is not a research body and does not operate in the health sector. It neither conducts nor supports public health studies, clinical research or epidemiological surveys using personal data, and maintains no database constituted for that purpose. It therefore does not rely on the legal basis for processing for studies by a research body, nor on the waiver of consent associated with it, and there is no anonymization procedure for research purposes to be demonstrated.',
        nuncaExcluir:
          'Medical certificates, pre-employment and periodic examinations, health plan data and social security leave are sensitive personal data in any company. They stay in scope under Art. 11, which does not leave on this question.',
      },
      dados_entregues_a_outra_empresa: {
        pergunta:
          'Does the company hand personal data to another company for that company to use on its own account?',
        ajuda:
          "Answer YES if it sends employee or customer data to a health plan operator, an insurer, the bank that runs payroll, a meal or transport voucher provider, a credit bureau such as Serasa or Boa Vista, or a commercial partner that receives a customer list, or if it sells, trades or assigns contacts. Engaging a supplier that merely carries out a task under the company's instructions, such as accounting, a payroll system, a call center or cloud hosting, does NOT count here.",
        justificativa:
          "The organization does not communicate or share personal data with other controllers. The personal data under its responsibility is processed exclusively for the purposes it defines and, where third parties take part, they act as processors, handling the data only in accordance with the organization's documented instructions, which is assessed in the articles concerning the processor and the security of processing. There is no transfer or making available of personal data to a third party that would use it for a purpose of its own and, consequently, no legal basis to be demonstrated for shared use between controllers.",
        nuncaExcluir:
          "If the company has a health plan, life insurance, meal vouchers or pays payroll through a bank, the answer is YES. Answering NO also does not remove the obligations regarding suppliers that process data on the company's behalf (Art. 39 and Art. 44) or the record of processing operations (Art. 37).",
        aviso:
          'In the system, the text of this article does not match the article in the law; check the requirement description before confirming the exclusion.',
      },
      uso_de_dados_nao_pedido_pela_pessoa: {
        pergunta:
          'Does the company use personal data for a purpose the person did not ask for and that no contract or law requires?',
        ajuda:
          "Examples of YES: prospecting from purchased lists or contacts collected online; tracking the behavior of website visitors in order to offer products; using customer data for fraud prevention; enriching records with information bought from third parties; monitoring employees beyond what labor law requires. If every use of data arises from the person's own request, from a signed contract or from a legal requirement, answer NO. Answer YES if the company has security cameras, turnstiles, badges or biometrics, or keeps a log of who accessed each system: that is legitimate interest, and almost every company has it.",
        justificativa:
          "The organization does not rely on the legal basis of legitimate interest. All of its personal data processing operations are grounded in the data subject's consent, the performance of a contract or of preliminary procedures thereto, compliance with a legal or regulatory obligation, the regular exercise of rights or the protection of life, as recorded in the register of processing activities. With no processing grounded in legitimate interest, there is no concrete situation to substantiate, no legitimate purpose to demonstrate and no balancing against the fundamental rights and freedoms of the data subject to document. Adopting that legal basis in the future will require this article to be reassessed and the corresponding balancing test to be prepared.",
        nuncaExcluir:
          'The ten legal bases of Art. 7 stay in scope: the company must record which basis it uses for each activity. If it ever starts relying on legitimate interest, for anti-fraud or marketing for example, this article comes back.',
      },
      participacao_na_estrutura_da_anpd: {
        pergunta:
          'Is the company part of the ANPD, the federal body that supervises data protection?',
        ajuda:
          'The ANPD is the authority that supervises and imposes fines. Some articles of the law only describe how that body is organized internally, how many directors it has, and from what date the law took effect. Those articles ask nothing of your company: there is no policy to write, no evidence to keep and no process to build. Answer YES only if the company is the ANPD itself or a body forming part of its structure. Any private company answers NO.',
        justificativa:
          "Articles 55-C and 55-D of Law No. 13,709/2018 govern the internal composition, the technical autonomy and the powers of the board of directors of the National Data Protection Authority. The organization is a private legal entity and does not form part of the Authority's structure, so these provisions impose no obligation on it.",
        nuncaExcluir:
          'The articles setting out what the ANPD may require and enforce against the company stay in scope: Art. 55-A, Art. 55-J and Art. 55-K, along with the sanctions and how they are calibrated (Art. 52, Art. 53 and Art. 54). Art. 55-L stays as well: in the system it appears under the title Impact Assessment, and until that title is corrected nothing resembling an impact assessment should leave the list.',
      },
    },
  },

  soc2: {
    intro:
      'The first four of these {n} questions decide whole SOC 2 categories at once — Availability, Processing Integrity, Confidentiality and Privacy — and the ones after them clear specific criteria out of what is left. The Security common criteria (CC1.1 to CC8.1) never leave, whatever you answer.',
    perguntas: {
      compromisso_de_disponibilidade: {
        pergunta:
          'Does any contract, proposal or email of yours promise in writing that the system stays up, that it comes back within a set time after going down, or provide for credits or penalties if it is unavailable?',
        ajuda:
          'Look in the contract for the words SLA, availability, uptime or downtime. If nobody promised anything in writing and no customer has ever formally claimed it, answer NO.',
        justificativa:
          'The organization has made no contractual commitment to any customer regarding availability, recovery time or service level for the system included in the scope. With no availability commitment to be demonstrated, the Availability category does not form part of the scope of this report, which is limited to the Security category. Should the organization take on a commitment of that nature, the category will be brought back into scope before the start of the next audit period.',
        nuncaExcluir:
          'Backup and recovery do not disappear from your list. Even with no Availability category, the auditor will test whether you can resume operations after a security incident, and that lives in CC7.1 and CC7.2, which are mandatory. Keep backing up and keep testing restores.',
      },
      processamento_calcula_valores: {
        pergunta:
          "Does your system calculate or generate figures on the customer's behalf, such as payroll, billing, taxes, balances, invoices or commissions, where a wrong value would cause them direct financial loss?",
        ajuda:
          'Storing, displaying and letting the customer edit data they typed in themselves does not count. It counts when your system is what produces the figure the customer uses to pay, to bill or to file.',
        justificativa:
          'The system included in the scope performs no processing that produces financial, tax or calculated results on behalf of customers; it is limited to storing, presenting and making available information supplied by the users themselves, who remain responsible for its accuracy. The organization has made no commitment to customers regarding the completeness, accuracy, validity or timeliness of processing. For that reason, the Processing Integrity category does not form part of the scope of this report.',
        nuncaExcluir:
          'If your company issues invoices, closes payroll, performs bank reconciliation or calculates commissions for the customer, answer YES even if it uses third-party software to do it. And do not confuse the two: recording what the system did remains mandatory under CC7.1, which stays in scope either way.',
      },
      compromisso_de_sigilo: {
        pergunta:
          'Has any customer required you to treat their information as confidential, whether through a signed non-disclosure agreement, a confidentiality clause in the contract, or a commitment to delete the data when the contract ends?',
        ajuda:
          'Look in the contract for the words confidentiality, secrecy or NDA. If you have already signed a non-disclosure agreement with any customer, the answer is YES.',
        justificativa:
          'The organization has made no specific confidentiality commitments to customers or partners regarding the information processed in the system included in the scope, and holds no non-disclosure agreements applicable to that data. For that reason, the Confidentiality category does not form part of the scope of this report. The logical access, segregation and encryption protections applied to that information remain assessed under the common criteria of the Security category.',
        nuncaExcluir:
          'Encryption and access control do NOT leave. They remain mandatory under CC6.1, CC6.2 and CC6.3. What leaves is only the additional confidentiality commitment over a set of data the customer marked as confidential. Almost every company that sells to other companies has signed some NDA: when in doubt, answer YES.',
      },
      dados_pessoais_de_terceiros: {
        pergunta:
          'Does the system to be audited hold data about individuals who are not your employees, such as name, national identification number, email, phone, address, health data or payment data?',
        ajuda:
          "Your own employees' data, held in the HR system, does not count here. What counts is the records of your customer's customers, or of the end users who use your system.",
        justificativa:
          'The system included in the scope does not collect, store, use, disclose or dispose of personal data of data subjects external to the organization. The only personal data processed by the organization concerns its own employees and is handled in administrative systems that do not form part of the scope of this report. For that reason, the Privacy category does not form part of the scope. The organization will reassess this definition should the system come to process personal data of external data subjects.',
        nuncaExcluir:
          "The work email of your customer's contact is already personal data. If your system holds any record with a person's name and email, answer YES. Privacy is the category where most companies fail for having drawn the scope wrong: when in doubt, leave it in.",
      },
      terceiros_acessam_dados_pessoais: {
        pergunta:
          'Does any outside company receive or have access to the personal data held in your system, such as a cloud provider, an email tool, outsourced support, BI or a collections agency?',
        ajuda:
          'Only answer this question if the Privacy category stayed in scope. Count the cloud provider (AWS, Azure, Google Cloud) too, and any contracted tool that this data passes through. Answer NO only if everything runs on servers of the company itself, operated exclusively by your own employees.',
        justificativa:
          "The organization does not disclose, transfer or grant access to personal data to third parties. All processing takes place on infrastructure of its own, operated exclusively by the organization's employees, with no involvement of subcontractors, service providers or partners. With no disclosure to third parties during the audited period, criteria P6.1 and P6.2 do not apply. The organization will subject any future third party to prior assessment and to a contractual data protection commitment before granting access.",
        nuncaExcluir:
          'If you use any cloud, the answer is YES: hosting on AWS is already granting a third party access. Answering NO here by mistake sinks the audit, because the list of suppliers that touch the data is one of the first things the auditor asks for.',
      },
      conciliacao_com_sistema_de_origem: {
        pergunta:
          "Do the figures your system shows have to match another system that is the official source of the data, such as the ERP, the bank or the customer's own system?",
        ajuda:
          'Only answer this question if the Processing Integrity category stayed in scope. If your system is where the data originates, and there is no other system to check it against, answer NO.',
        justificativa:
          'The system included in the scope is the origin of the data it processes and does not receive information from an external system of record against which it should be reconciled. With no independent source to be compared against, there is no processing reconciliation to perform, which is why criterion PI1.5 does not apply to the audited period. Completeness and accuracy controls over processing remain assessed under criteria PI1.2, PI1.3 and PI1.4.',
        nuncaExcluir:
          'This does not mean that nobody checks anything. Checking that processing came out complete and correct remains mandatory under PI1.3 and PI1.4, and error correction remains under PI3.1 and PI3.2.',
      },
    },
  },
};
