/**
 * Lightweight i18n dictionary.
 *
 * The platform defaults to French (fr) — see docs/Clients_Sheet_Merged.txt
 * "French Terminology Mapping" and tenants.default_locale.
 *
 * Arabic (ar) and English (en) are supported as fallbacks. The language is
 * chosen via the `lang` state in the i18n store (user preference, persisted
 * in localStorage).
 *
 * Note: The portal does NOT do full route-based i18n (next-intl). It uses a
 * simple key→string lookup so we can switch languages instantly without a
 * page reload, which matches the mobile-first UX.
 */

import { env } from "@/lib/env";

export type Locale = "fr" | "ar" | "en";

export const LOCALES: Locale[] = ["fr", "ar", "en"];
export const DEFAULT_LOCALE: Locale = env.NEXT_PUBLIC_DEFAULT_LOCALE;

type Dict = Record<string, string>;

const fr: Dict = {
  // App
  "app.name": "El-Imtiyaz",
  "app.tagline": "Espace Parent & Élève",
  "app.loading": "Chargement…",

  // Auth
  "auth.signin.title": "Bienvenue sur le portail El-Imtiyaz",
  "auth.signin.subtitle":
    "Connectez-vous avec votre compte Google pour accéder à votre espace.",
  "auth.signin.google": "Se connecter avec Google",
  "auth.signin.secure": "Connexion sécurisée via Supabase Auth",
  "auth.signin.help": "Besoin d'aide ? Contactez l'administration de l'école.",
  // AUTH-200 (19th session): shown when the Supabase Google provider is
  // disabled server-side — the owner-side enablement runbook lives in the
  // hub repo (docs/operations/portal-google-oauth.md).
  "auth.signin.providerDisabled":
    "La connexion Google n'est pas encore activée sur le portail. Veuillez contacter l'administration de l'école pour terminer la configuration.",
  "auth.signin.configError.title": "Configuration manquante",
  "auth.signin.configError.body":
    "Le portail n'est pas encore connecté à Supabase. Veuillez configurer NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local",
  "auth.callback.processing": "Authentification en cours…",
  "auth.callback.redirecting": "Redirection…",
  "auth.signout": "Se déconnecter",
  "auth.signout.confirm": "Voulez-vous vraiment vous déconnecter ?",

  // Activation states
  "activation.pending.title": "Votre compte n'a pas encore été activé",
  "activation.pending.body":
    "Votre compte a été créé avec succès, mais il est en attente d'activation par l'administration de l'établissement. " +
    "Une fois activé, vous aurez automatiquement accès à vos informations et à celles de vos enfants.",
  "activation.pending.contact":
    "Veuillez contacter l'administration de votre école pour finaliser l'activation.",
  "activation.pending.signout": "Se déconnecter",
  "activation.suspended.title": "Votre compte a été suspendu",
  "activation.suspended.body":
    "L'accès à votre compte a été suspendu par l'administration. Pour plus d'informations, veuillez contacter l'établissement.",
  "activation.rejected.title": "Demande d'accès refusée",
  "activation.rejected.body":
    "Votre demande d'accès au portail a été refusée. Pour toute question, veuillez contacter l'administration.",

  // Nav
  "nav.home": "Accueil",
  "nav.academic": "Scolarité",
  "nav.finance": "Paiements",
  "nav.messages": "Messages",
  "nav.profile": "Profil",
  "nav.notifications": "Notifications",
  "nav.attendance": "Absences",
  "nav.homework": "Travaux",
  "nav.calendar": "Agenda",
  "nav.timetable": "Emploi du temps",

  // Timetable (T-407 — the published weekly schedule)
  "timetable.empty": "Aucun emploi du temps publié pour le moment. Il sera visible ici dès sa publication par l'établissement.",
  "timetable.period": "S{index}",
  "timetable.double": "Séance double",
  "timetable.publishedHint": "Emploi du temps officiel publié par l'établissement — toute modification est validée par l'administration avant publication.",
  "timetable.day.sunday": "Dimanche",
  "timetable.day.monday": "Lundi",
  "timetable.day.tuesday": "Mardi",
  "timetable.day.wednesday": "Mercredi",
  "timetable.day.thursday": "Jeudi",
  "timetable.day.friday": "Vendredi",
  "timetable.day.saturday": "Samedi",

  // Dashboard
  "dashboard.greeting.morning": "Bonjour",
  "dashboard.greeting.afternoon": "Bon après-midi",
  "dashboard.greeting.evening": "Bonsoir",
  "dashboard.section.children": "Mes enfants",
  "dashboard.section.upcoming": "À venir",
  "dashboard.section.recent": "Activité récente",
  "dashboard.section.balance": "Solde du compte",
  "dashboard.section.announcements": "Annonces",
  "dashboard.viewAll": "Tout voir",
  "dashboard.empty.noChildren":
    "Aucun enfant n'est encore rattaché à votre compte.",
  "dashboard.empty.noUpcoming": "Aucun événement à venir.",
  "dashboard.empty.noUpcomingBody":
    "Les événements publiés par l'établissement apparaîtront ici.",
  "dashboard.empty.noAnnouncements": "Aucune annonce pour le moment.",
  "dashboard.empty.noAnnouncementsBody":
    "Les annonces de l'administration destinées aux parents apparaîtront ici.",

  // KPI labels
  "kpi.balanceDue": "Solde dû",
  "kpi.nextInstallment": "Prochaine échéance",
  "kpi.attendanceRate": "Taux de présence",
  "kpi.averageGrade": "Moyenne générale",
  "kpi.unreadMessages": "Messages non lus",
  "kpi.upcomingEvents": "Événements à venir",

  // Student
  "student.select": "Sélectionner un enfant",
  "student.class": "Classe",
  "student.level": "Niveau",
  "student.enrollmentStatus": "Statut d'inscription",
  "student.code": "Matricule",
  "student.attendance": "Présence",
  "student.grades": "Notes",
  "student.filiere": "Filière",
  "student.specialite": "Spécialité",
  "student.gpa": "Moyenne",
  "student.term": "Trimestre",
  "academic.terms.all": "Toutes",
  "student.subject": "Matière",
  "student.coefficient": "Coefficient",
  "student.score": "Note",
  "student.average": "Moyenne",
  // T-336 (GRADE-102): the desktop/Android "Moyenne à paraître" hint — the
  // canonical subject average needs all three marks (D1 + D2 + Examen).
  "student.average.pending": "Moyenne à paraître — les 3 notes (devoir 1, devoir 2, examen) doivent être saisies",
  "student.mark.cc": "C.Continu",
  "student.rank": "Rang",
  "student.appreciation": "Appréciation",
  "student.bulletin": "Bulletin",
  "student.bulletin.download": "Télécharger le bulletin (PDF)",

  // Children detail (T-210 — the per-child identity + enrollment card)
  "children.title": "Mes enfants",
  "children.identityNote": "Informations gérées par l'administration",
  "student.dateOfBirth": "Date de naissance",
  "student.gender": "Sexe",
  "student.gender.male": "Garçon",
  "student.gender.female": "Fille",
  "student.gender.other": "Autre",
  "student.enrollmentDate": "Date d'inscription",
  "student.yearsOld": "ans",
  "student.status.inquiry": "Demande d'information",
  "student.status.quoted": "Devis envoyé",
  "student.status.enrolled": "Inscrit",
  "student.status.active": "En cours",
  "student.status.withdrawn": "Retiré",
  "student.status.graduated": "Diplômé",

  // Children enrollments (T-211 — per-child services + fee schedule)
  "enrollments.title": "Inscriptions et services",
  "enrollments.academicYear": "Année scolaire",
  "enrollments.services": "Services inscrits",
  "enrollments.servicesEmpty":
    "Aucun service inscrit pour le moment (scolarité hors périmètre).",
  "enrollments.feeSchedule": "Échéancier des frais",
  "enrollments.feeScheduleEmpty": "Aucun échéancier pour le moment.",
  "enrollments.destination": "Destination",
  "enrollments.inactive": "Inactif",
  "enrollments.service.club": "Club",
  "enrollments.service.psychotherapy": "Psychothérapie",
  "enrollments.service.rattrapage": "Rattrapage",

  // Attendance
  "attendance.title": "Absences et retards",
  "attendance.summary.present": "Présences",
  "attendance.summary.excused": "Absences justifiées",
  "attendance.summary.unexcused": "Absences non justifiées",
  "attendance.summary.late": "Retards",
  "attendance.justification": "Justification",
  "attendance.justification.note": "Note de justification",
  "attendance.justification.uploaded": "Justificatif fourni",
  "attendance.justification.pending": "En attente de justification",
  "attendance.empty": "Aucune absence enregistrée.",

  // Homework
  "homework.title": "Travaux à faire",
  "homework.due": "À rendre le",
  "homework.subject": "Matière",
  "homework.overdue": "En retard",
  "homework.dueToday": "À rendre aujourd'hui",
  "homework.dueTomorrow": "À rendre demain",
  "homework.empty": "Aucun travail à faire pour le moment.",
  "homework.attachments": "Pièces jointes",
  "homework.locked": "Verrouillé",

  // Calendar
  "calendar.title": "Agenda",
  "calendar.today": "Aujourd'hui",
  "calendar.prevMonth": "Mois précédent",
  "calendar.nextMonth": "Mois suivant",
  "calendar.events": "Événements",
  "calendar.noEvents": "Aucun événement ce jour",
  "calendar.eventType.exam": "Examen",
  "calendar.eventType.holiday": "Férié",
  "calendar.eventType.meeting": "Réunion",
  "calendar.eventType.deadline": "Échéance",
  "calendar.eventType.activity": "Activité",
  "calendar.eventType.other": "Autre",
  "calendar.eventType.payment": "Paiement",
  "calendar.filter": "Filtrer",
  "calendar.filterAll": "Tous",
  "calendar.exams": "Examens",
  "calendar.exam.title": "Examens à venir",
  "calendar.exam.room": "Salle",
  "calendar.exam.invigilator": "Surveillant",
  "calendar.exam.date": "Date",
  "calendar.exam.time": "Heure",
  "calendar.exam.empty": "Aucun examen programmé.",
  "calendar.allDay": "Toute la journée",

  // Financial
  "finance.title": "Paiements & Factures",
  "finance.balance.outstanding": "Solde à payer",
  "finance.balance.outstandingHint": "Montant total restant à régler",
  "finance.balance.overdue": "En retard",
  "finance.balance.overdueHint":
    "Échéances dépassées — contactez l'administration",
  "finance.balance.noOverdue": "Aucun retard",

  // T-405 — debt aging / payment-behavior status (financial-rules §15)
  "finance.debtAging.title": "Suivi de votre dossier",
  "finance.debtAging.originYear": "Année d'origine",
  "finance.debtAging.debtAge": "Ancienneté de la dette",
  "finance.debtAging.lastPayment": "Dernier paiement",
  "finance.debtAging.inactivity": "Inactivité",
  "finance.debtAging.subsequentPayments": "Paiements années suivantes",
  "finance.debtAging.days": "jours",
  "finance.debtAging.never": "Jamais",
  "finance.debtAging.yes": "Oui",
  "finance.debtAging.no": "Non",
  "finance.debtAging.status.green": "Actif / Soldé",
  "finance.debtAging.status.yellow": "À surveiller",
  "finance.debtAging.status.orange": "Retard soutenu",
  "finance.debtAging.status.red": "Critique",
  "finance.balance.paidHint": "Total encaissé à ce jour",
  "finance.balance.pendingHint": "{amount} en attente de compensation",
  "finance.balance.credit": "Crédit sur compte",
  "finance.balance.creditHint": "Avance enregistrée à votre faveur",
  "finance.balance.noCredit": "Aucune avance",
  "finance.balance.settled": "Compte à jour",
  "finance.installments": "Tranches",
  "finance.payments": "Paiements",
  "finance.invoices": "Factures",
  "finance.receipts": "Reçus",
  "finance.installment.tranche": "Tranche",
  "finance.installment.amount": "Montant",
  "finance.installment.due": "Échéance",
  "finance.installment.paid": "Payé",
  "finance.installment.pending": "En attente",
  "finance.installment.fullAnnual": "Paiement annuel",
  "finance.installment.remaining": "Reste à payer",
  "finance.installment.status": "Statut",
  "finance.payment.date": "Date",
  "finance.payment.amount": "Montant",
  "finance.payment.method": "Mode",
  "finance.payment.method.cash": "Espèces",
  "finance.payment.method.check": "Chèque",
  "finance.payment.method.transfer": "Virement",
  "finance.payment.receipt": "Reçu",
  "finance.payment.viewReceipt": "Voir le reçu",
  "finance.payment.proof": "Justificatif",
  "finance.payment.proofTitle": "Justificatif de paiement",
  "finance.payment.checkNumber": "N° chèque",
  "finance.payment.checkBank": "Banque",
  "finance.payment.clearance": "Encaissement",
  "finance.payment.transferRef": "Référence",
  "finance.payment.transferBank": "Banque émettrice",
  "finance.payment.openProof": "Ouvrir le justificatif",
  "finance.empty.noPayments": "Aucun paiement enregistré pour le moment.",
  "finance.empty.noPaymentsBody":
    "Les paiements encaissés au comptoir par l'établissement apparaîtront ici.",
  "finance.empty.noInstallments": "Aucune échéance à afficher.",
  "finance.empty.noInstallmentsBody":
    "L'établissement n'a pas encore publié d'échéancier pour votre famille.",
  "finance.status.paid": "Payé",
  "finance.status.partial": "Partiel",
  "finance.status.unpaid": "Non payé",
  "finance.status.overdue": "En retard",
  "finance.status.pending": "En attente",
  "finance.status.refunded": "Remboursé",
  // T-056 / WEAK-020 — the two canonical statuses the tone map previously dropped through
  "finance.status.cancelled": "Annulé",
  "finance.status.pending_clearance": "Encaissement en cours",
  "finance.status.due": "Échéance",
  "finance.adjustments": "Ajustements",
  "finance.adjustment.title": "Ajustements de compte",
  "finance.adjustment.credit": "Crédit",
  "finance.adjustment.debit": "Débit",
  "finance.adjustment.reason": "Motif",
  "finance.adjustment.amount": "Montant",
  "finance.adjustment.date": "Date",
  "finance.adjustment.note": "Note de l'administration",
  "finance.adjustment.empty": "Aucun ajustement enregistré.",
  "finance.adjustment.emptyBody":
    "Les remises et régularisations accordées par l'administration apparaîtront ici.",
  "finance.billing": "Facturation",
  "finance.billing.intro":
    "Décomposition du prix : ce qui a été facturé pour chaque enfant, service par service, et où en sont les échéances.",
  "finance.billing.perChild": "Par enfant",
  "finance.billing.perService": "Par service",
  "finance.billing.items": "Articles & prestations souscrites",
  "finance.billing.engagedTotal": "Total engagé",
  "finance.billing.year": "Année scolaire",
  "finance.billing.tranches": "Échéancier",
  "finance.billing.noCharges": "Aucune facturation enregistrée.",
  "finance.billing.noChargesBody":
    "Les prestations facturées par l'établissement apparaîtront ici.",
  "finance.billing.share": "du total",
  "finance.billing.subtotal": "Sous-total",
  "finance.billing.familyItems": "Famille — éléments non rattachés à un enfant",
  "finance.billing.recon": "Réconciliation du compte — chaque dinar expliqué",
  "finance.billing.recon.gross": "Brut facturé (articles)",
  "finance.billing.recon.credit": "− Remises / déductions",
  "finance.billing.recon.debit": "+ Majorations / annulations de remise",
  "finance.billing.recon.net": "= Net à payer",
  "finance.billing.recon.cleared": "− Encaissé confirmé",
  "finance.billing.recon.pending": "− En attente (chèque / virement)",
  "finance.billing.recon.remaining": "= Reste net",
  "finance.billing.recon.bridge":
    "± Pont — autres écritures (remboursements, contrepassations)",
  "finance.billing.recon.server": "Solde du compte (source : serveur)",
  "finance.billing.elements": "éléments",
  "finance.svc.detail": "Détail exhaustif — tout ce que couvre ce prix",
  "finance.svc.detail.hide": "Masquer le détail",
  "finance.svc.year": "Année couverte",
  "finance.svc.coverage": "Couverture par enfant",
  "finance.svc.level": "Niveau",
  "finance.svc.cycle": "Cycle",
  "finance.svc.class": "Classe",
  "finance.svc.code": "Matricule",
  "finance.svc.catalog": "Tarif officiel (catalogue)",
  "finance.svc.catalog.annual": "Annuel",
  "finance.svc.catalog.tranche": "Tranche {n}",
  "finance.svc.catalog.dueMonth": "échéance {month}",
  "finance.svc.catalog.unit": "Prix unitaire",
  "finance.svc.catalog.semester": "Par semestre",
  "finance.svc.catalog.model": "Facturation : {model}",
  "finance.svc.catalog.kind.tuition_by_grade": "Scolarité — tarif du niveau",
  "finance.svc.catalog.kind.transport_by_destination": "Transport — tarif de la zone",
  "finance.svc.catalog.kind.registration_fee": "Frais d'inscription",
  "finance.svc.catalog.kind.additional_service": "Service additionnel",
  "finance.svc.catalog.kind.complementary_service": "Service complémentaire",
  "finance.svc.conditions": "Conditions applicables",
  "finance.svc.cond.pct": "{v} % du prix",
  "finance.svc.cond.fixed": "{v} DA",
  "finance.svc.cond.deadline": "avant le {date}",
  "finance.svc.items": "Éléments facturés ({n})",
  "finance.svc.item.tranche": "Tranche {n}",
  "finance.svc.item.plan": "Plan : {plan}",
  "finance.svc.item.zone": "Zone : {zone}",
  "finance.svc.discounts": "Remises appliquées",
  "finance.svc.discounts.none": "Aucune remise appliquée sur ce service.",
  "finance.svc.plan": "Échéancier de paiement (cadre des tranches)",
  "finance.svc.plan.none": "Aucun échéancier physique — devis global.",
  "finance.svc.plan.due": "Échéance",
  "finance.svc.construction": "Construction du prix",
  "finance.svc.construction.catalog": "Tarif catalogue (référence)",
  "finance.svc.construction.gross": "Devis brut facturé",
  "finance.svc.construction.debit": "+ Annulations de remise / majorations",
  "finance.svc.construction.discounts": "− Remises appliquées",
  "finance.svc.construction.net": "= Net facturé",
  "finance.svc.construction.delta": "Écart vs tarif catalogue",
  "finance.svc.construction.noCatalog": "Référence catalogue non mappable",
  "finance.svc.provenance": "Provenance",
  "finance.svc.provenance.excel_import": "Import Excel",
  "finance.svc.provenance.current_year_wizard": "Saisie année en cours",
  "finance.svc.provenance.reconciliation": "Réconciliation",
  "finance.svc.provenance.manual": "Saisie manuelle",
  "finance.svc.provenance.unknown": "Origine non documentée",
  "finance.svc.provenance.run": "run {id}",
  "finance.adjustment.reason.sibling_discount": "Remise fratrie",
  "finance.adjustment.reason.staff_family": "Famille du personnel",
  "finance.adjustment.reason.early_payment": "Paiement anticipé",
  "finance.adjustment.reason.passage_palier": "Passage de palier",
  "finance.adjustment.reason.seniority_5y": "Ancienneté 5 ans",
  "finance.adjustment.reason.highest_average": "Meilleure moyenne",
  "finance.adjustment.reason.full_annual": "Paiement annuel",
  "finance.adjustment.reason.scholarship_replacement": "Bourse de remplacement",
  "finance.adjustment.reason.hardship": "Difficulté sociale",
  "finance.adjustment.reason.correction": "Correction",
  "finance.adjustment.reason.other": "Autre",
  "finance.receipt.download": "Télécharger le reçu (PDF)",
  "finance.statement.download": "Télécharger le relevé de compte (PDF)",
  "finance.statement.generate": "Générer un relevé",
  "finance.restrictions.title": "Accès financier restreint",
  "finance.restrictions.body":
    "L'accès à certaines fonctionnalités financières de votre compte est actuellement restreint. " +
    "Veuillez contacter l'administration pour régulariser votre situation.",

  // Ledger statement (source of truth — INV-1)
  "finance.ledger.title": "Relevé",
  "finance.ledger.intro":
    "Relevé de compte complet : chaque facturation, paiement et ajustement dans l'ordre chronologique, avec le solde progressif — exactement comme le calcule l'établissement.",
  "finance.ledger.balance": "solde",
  "finance.ledger.running": "Solde",
  "finance.ledger.empty.title": "Aucune écriture au relevé",
  "finance.ledger.empty.body":
    "Les écritures de votre compte (facturations, paiements, ajustements) apparaîtront ici.",
  "finance.ledger.type.charge": "Facturation",
  "finance.ledger.type.payment": "Paiement",
  "finance.ledger.type.adjustment": "Ajustement",
  "finance.ledger.type.refund": "Remboursement",
  "finance.ledger.type.reversal": "Annulation",
  "finance.ledger.type.transfer": "Transfert",

  // Billing categories (payment_category enum)
  "finance.category.tuition": "Scolarité",
  "finance.category.transport": "Transport",
  "finance.category.canteen": "Cantine",
  "finance.category.uniform": "Tenue",
  "finance.category.books": "Livres",
  "finance.category.extracurricular": "Activités",
  "finance.category.therapy_psychology": "Suivi psychologique",
  "finance.category.therapy_speech": "Orthophonie",
  "finance.category.second_apron": "Deuxième tablier",
  "finance.category.parent_credit": "Crédit famille",
  "finance.category.other": "Autre",

  // Messages
  "messages.title": "Messages",
  "messages.empty": "Aucun message.",
  "messages.reply": "Répondre",
  "messages.send": "Envoyer",
  "messages.placeholder": "Écrivez votre message…",
  "messages.fromSchool": "De l'école",
  "messages.convocation": "Convocation",
  "messages.convocation.notice":
    "Convocation officielle de la direction — votre présence est requise. Veuillez contacter l'administration pour confirmer.",
  // T-149 (ADR-012) — the parent-initiated administration channel.
  "messages.contactAdmin": "Contacter l'administration",
  "messages.contactAdmin.opening": "Ouverture de la conversation…",
  "messages.contactAdmin.body":
    "Posez vos questions et consultez les rapports scolaires directement avec l'administration.",
  "messages.contactAdmin.success":
    "Conversation avec l'administration ouverte.",
  "messages.contactAdmin.error":
    "Impossible d'ouvrir la conversation. Veuillez réessayer.",

  // Notifications
  "notifications.title": "Notifications",
  "notifications.empty": "Aucune notification.",
  "notifications.markAllRead": "Tout marquer comme lu",
  "notifications.priority.urgent": "Urgent",
  "notifications.priority.high": "Important",
  "notifications.priority.medium": "Normal",
  "notifications.priority.low": "Faible",

  // Profile
  "profile.title": "Mon profil",
  "profile.account": "Compte",
  "profile.email": "Email",
  "profile.name": "Nom",
  "profile.phone": "Téléphone",
  "profile.role": "Rôle",
  "profile.status": "Statut",
  "profile.tenant": "Établissement",
  "profile.language": "Langue",
  "profile.theme": "Thème",
  "profile.theme.dark": "Sombre",
  "profile.theme.light": "Clair",
  "profile.status.active": "Actif",
  "profile.status.pending": "En attente",
  "profile.status.suspended": "Suspendu",
  "profile.about": "À propos",
  "profile.about.body":
    "Ce portail vous donne accès aux informations de vos enfants : notes, absences, paiements, annonces et communications scolaires. " +
    "L'activation de votre compte est gérée par l'administration de l'établissement.",
  "profile.help": "Assistance",
  "profile.help.contact": "Contacter l'administration",
  "profile.version": "Version",

  // Common
  "common.refresh": "Actualiser",
  "common.retry": "Réessayer",
  "common.close": "Fermer",
  "common.cancel": "Annuler",
  "common.save": "Enregistrer",
  "common.delete": "Supprimer",
  "common.edit": "Modifier",
  "common.view": "Voir",
  "common.back": "Retour",
  "common.search": "Rechercher",
  "common.error.title": "Une erreur est survenue",
  "common.error.network": "Problème de connexion. Vérifiez votre réseau.",
  "common.error.unknown":
    "Veuillez réessayer. Si le problème persiste, contactez l'administration.",
  "common.empty.title": "Rien à afficher",
  "common.tryAgain": "Réessayer",
  "common.syncing": "Synchronisation…",
  "common.updated": "Mis à jour",
  "common.justNow": "À l'instant",

  // Activation code entry (Path A self-service)
  "activation.code.title": "J'ai un code d'activation",
  "activation.code.subtitle":
    "Si l'établissement vous a remis un code d'activation à 6 ou 7 chiffres, " +
    "saisissez-le ci-dessous pour lier votre compte Google à votre dossier familial.",
  "activation.code.input": "Code d'activation",
  "activation.code.submit": "Activer mon compte",
  "activation.code.submitting": "Activation en cours…",
  "activation.code.success.title": "Compte activé",
  "activation.code.success.body":
    "Votre compte est maintenant lié à votre dossier familial. " +
    "L'administration va finaliser l'activation. Vous pouvez rafraîchir cette page.",
  "activation.code.error.invalid":
    "Code d'activation invalide ou déjà utilisé.",
  "activation.code.error.expired":
    "Ce code d'activation a expiré. Veuillez en demander un nouveau à l'administration.",
  // T-153 (ACT-200) — precise bind-failure messages (mapped by the EF's error code).
  "activation.code.error.suspended":
    "Ce compte est suspendu. Veuillez contacter l'administration de l'école.",
  "activation.code.error.session":
    "Session invalide. Veuillez vous reconnecter, puis réessayer.",
  "activation.code.error.bound":
    "Ce dossier familial est déjà lié à un autre compte. Veuillez contacter l'administration.",
  // T-187 (ACT-204) — fetch-level failure (network / CORS block / offline):
  // no HTTP response exists, so mapActivationError never runs; the generic
  // key misled users during the ACT-201/ACT-203 era.
  "activation.code.error.network":
    "Impossible de joindre le serveur. Vérifiez votre connexion internet, puis réessayez. " +
    "Si le problème persiste, contactez l'administration.",
  "activation.code.error.generic":
    "Impossible d'activer le compte. Veuillez réessayer.",
  "activation.code.haveCode": "J'ai déjà un code d'activation",

  // T-413 — the student enrollment application form (pending screen)
  "application.title": "Inscription d'un élève",
  "application.subtitle": "Préparez le dossier de votre enfant dès maintenant — l'administration le traitera avec votre demande.",
  "application.student.firstName": "Prénom de l'élève",
  "application.student.lastName": "Nom de l'élève",
  "application.student.dob": "Date de naissance",
  "application.student.gender": "Genre",
  "application.student.male": "Garçon",
  "application.student.female": "Fille",
  "application.student.level": "Niveau scolaire souhaité",
  "application.note": "Message à l'administration (facultatif)",
  "application.notePlaceholder": "Informations utiles pour l'inscription…",
  "application.submit": "Envoyer la demande d'inscription",
  "application.saving": "Envoi…",
  "application.saved.title": "Demande d'inscription enregistrée",
  "application.saved.body": "Votre demande a été jointe à votre compte. L'administration la traitera lors de l'activation.",
  "application.edit": "Modifier la demande",
  "application.error.required": "Le prénom et le nom de l'élève sont obligatoires.",
  "application.error.notSaved": "La demande n'a pas pu être enregistrée. Réessayez ou contactez l'administration.",
  "activation.code.dontHaveCode": "Je n'ai pas de code d'activation",
  "activation.code.adminApproval": "Demander l'activation par l'administration",

  // Notification preferences
  "prefs.notifications.title": "Préférences de notifications",
  "prefs.notifications.body":
    "Choisissez les catégories de notifications que vous souhaitez recevoir " +
    "par push et/ou dans l'application.",
  "prefs.notifications.push": "Push",
  "prefs.notifications.inApp": "In-app",
  "prefs.notifications.category.payment": "Paiements et échéances",
  "prefs.notifications.category.absence": "Absences et justifications",
  "prefs.notifications.category.message": "Messages de l'établissement",
  "prefs.notifications.category.announcement": "Annonces générales",
  "prefs.notifications.category.grade": "Notes et bulletins",
  "prefs.notifications.category.homework": "Travaux à faire",
  "prefs.notifications.category.calendar": "Événements du calendrier",
  "prefs.notifications.category.account": "Sécurité du compte",
  "prefs.notifications.category.system": "Système",
  "prefs.notifications.saved": "Préférences enregistrées",

  // Student documents
  "documents.title": "Documents",
  "documents.body":
    "Téléversez les documents demandés par l'établissement : " +
    "certificat de naissance, certificat médical, contrat, etc.",
  "documents.upload": "Téléverser un document",
  "documents.kind.birth_certificate": "Acte de naissance",
  "documents.kind.medical_certificate": "Certificat médical",
  "documents.kind.contract": "Contrat",
  "documents.kind.justification_letter": "Lettre de justification",
  "documents.kind.id_photo": "Photo d'identité",
  "documents.kind.report_card": "Bulletin précédent",
  "documents.kind.other": "Autre",
  "documents.file": "Fichier",
  "documents.description": "Description (optionnel)",
  "documents.empty": "Aucun document téléversé pour le moment.",
  "documents.uploadedAt": "Téléversé le",
  "documents.delete": "Supprimer",
  "documents.delete.confirm": "Supprimer ce document ?",

  // Profile — edit contact info
  "profile.edit.title": "Modifier mes informations",
  "profile.edit.phone": "Téléphone principal",
  "profile.edit.secondaryPhone": "Téléphone secondaire",
  "profile.edit.email": "Email",
  "profile.edit.address": "Adresse",
  "profile.edit.city": "Ville",
  "profile.edit.postalCode": "Code postal",
  "profile.edit.occupation": "Profession",
  "profile.edit.save": "Enregistrer",
  "profile.edit.cancel": "Annuler",
  "profile.edit.saved": "Informations mises à jour",

  // Profile — identity details (T-209: the parent's personal details the
  // owner asked for; identity fields are staff-controlled — read-only here)
  "profile.relationship": "Lien de parenté",
  "profile.relationship.father": "Père",
  "profile.relationship.mother": "Mère",
  "profile.relationship.guardian": "Tuteur",
  "profile.relationship.other": "Autre",
  "profile.nationalId": "N° d'identité nationale",
  "profile.memberSince": "Membre depuis",
  "profile.parentCode": "Code parent",

  // Notifications extras
  "notifications.dismiss": "Ignorer",
  "notifications.open": "Ouvrir",
  "notifications.empty.unread": "Aucune notification non lue.",

  // Attendance — justification status
  "attendance.justification.status.none": "Aucune justification",
  "attendance.justification.status.submitted": "Justification soumise",
  "attendance.justification.status.accepted": "Justification acceptée",
  "attendance.justification.status.rejected": "Justification refusée",
  "attendance.justification.reviewedBy": "Examinée par l'administration",
  "attendance.justification.reviewNote": "Note de l'administration",

  // Common — generic
  "common.upload": "Téléverser",
  "common.download": "Télécharger",
  "common.yes": "Oui",
  "common.no": "Non",
  "common.loading": "Chargement…",
  "common.success": "Succès",
  "common.failed": "Échec",

  "student.dossier.view": "Voir le dossier complet",
  "student.history.title": "Historique Scolaire",
  "student.history.empty": "Aucun historique scolaire.",
  "student.notes.title": "Notes Médicales & Observations",
  "student.notes.empty": "Aucune observation enregistrée.",
  "student.dossier.open": "Dossier complet de l'élève",
  "student.dossier.overview": "Vue d'ensemble",
  "student.dossier.enrollments": "Inscriptions Financières",
  "student.dossier.identity": "Identité",
  "student.noClass": "Aucune classe assignée",
  "student.age": "Âge",
  "student.history.previousYears": "Années précédentes",
  "student.history.firstYear": "C'est probablement la première année de l'élève dans l'établissement.",
  "finance.payment.coverage": "Détails de la couverture",
  "finance.payment.coverage.hide": "Masquer la couverture",
  "finance.payment.coverageLoadError": "Impossible de charger les détails.",
  "finance.payment.coverageDerivedHint": "Couverture reconstituée à partir du relevé (aucune ventilation serveur pour ce paiement).",
  "finance.payment.expectedAmount": "Montant attendu (Facturé)",
  "finance.payment.excessAmount": "Trop-perçu (Crédit parent)",
  "finance.payment.allocationsEmpty": "Aucune allocation détaillée trouvée.",
  "finance.installment.daysLeft": "J-{days}",
  // ─── T-385 (I18N-500): full-coverage additions ───────────────────────────

  // App / nav chrome
  "app.portal": "El-Imtiyaz Portal",
  "app.version": "v1.0.0 — portal",
  "nav.primary": "Navigation principale",

  // Error surfaces (global-error + error boundary)
  "error.generic.title": "Une erreur inattendue est survenue",
  "error.generic.message": "Le portail a rencontré un problème.",
  "error.code": "Code :",
  "error.boundary.title": "Une erreur est survenue",
  "error.boundary.retryHint": "Veuillez réessayer.",

  // Offline / PWA / service-worker banners
  "offline.banner": "Vous êtes hors ligne. Les données affichées peuvent être obsolètes.",
  "pwa.install.title": "Installer le portail",
  "pwa.install.body": "Accédez plus rapidement depuis votre écran d'accueil",
  "pwa.install.action": "Installer",
  "pwa.install.later": "Plus tard",
  "sw.update.available": "Une nouvelle version du portail est disponible.",
  "sw.update.action": "Mettre à jour",

  // Absence justification dialog
  "attendance.justification.dialogTitle": "Justifier une absence",
  "attendance.justification.dialogSubtitle":
    "Fournissez une note explicative et/ou un justificatif (certificat médical, convocation, etc.). L'administration examinera votre demande.",
  "attendance.justification.notePlaceholder": "Ex : Certificat médical fourni. Enfant malade du…",
  "attendance.justification.attachmentLabel": "Pièce jointe (PDF, image — max 10 Mo)",
  "attendance.justification.chooseFile": "Choisir un fichier",
  "attendance.justification.remove": "Retirer",
  "attendance.justification.driveLink": "Lien Google Drive (optionnel)",
  "attendance.justification.sent": "Justification envoyée. L'administration va l'examiner.",
  "attendance.justification.uploadFailed": "Échec de l'envoi du fichier : {message}",
  "attendance.justifier": "Justifier cette absence",

  // Academic view
  "academic.noStudent": "Aucun élève sélectionné",
  "academic.grades.empty": "Aucune note pour cette période",
  "academic.bulletin.opened": "Bulletin ouvert — utilisez le dialogue d'impression pour enregistrer en PDF",
  "academic.cc.horsMoyenne": "• hors moyenne",

  // Auth
  "auth.or": "— ou —",

  // Financial — adjustments tab (render-layer mapping of the canonical FR output)
  "finance.adjust.pairLink": "↔ Paire annulée :",
  "finance.adjust.badge.credit": "Crédit / Déduction",
  "finance.adjust.badge.debit": "Débit / Majoration",
  "finance.adjust.provenance.documented": "Documenté",
  "finance.adjust.provenance.reversal_pair": "Contrepassation",
  "finance.adjust.provenance.undocumented": "Non documenté",
  "finance.adjust.meaning.reversal_pair":
    "Écriture annulée par une écriture inverse du même montant (probable ré-import ou correction d'erreur). Effet net sur le solde : nul.",
  "finance.adjust.meaning.undocumented.credit":
    "Entrée héritée sans motif (import système antérieur à la contrainte 0069) : déduction au motif inconnu — à auditer.",
  "finance.adjust.meaning.undocumented.debit":
    "Entrée héritée sans motif (import système antérieur à la contrainte 0069) : rétablissement de dette au motif inconnu — à auditer.",
  "finance.adjust.meaning.documented.credit":
    "Contenu réel : remise ou déduction appliquée par un opérateur, motif documenté — réduit le solde dû.",
  "finance.adjust.meaning.documented.debit":
    "Contenu réel : majoration ou annulation de remise appliquée par un opérateur, motif documenté — augmente le solde dû.",
  "finance.adjust.fallback.credit":
    "Déduction / remise enregistrée automatiquement par le système (motif non documenté)",
  "finance.adjust.fallback.debit":
    "Régularisation / rétablissement de dette (contrepassation automatique, motif non documenté)",

  // Financial — service categories (render-layer mapping of serviceLabelOf)
  "finance.svc.category.tuition": "Scolarité",
  "finance.svc.category.transport": "Transport",
  "finance.svc.category.canteen": "Cantine",
  "finance.svc.category.uniform": "Tenue / Uniforme",
  "finance.svc.category.books": "Fournitures & Livres",
  "finance.svc.category.extracurricular": "Activités parascolaires",
  "finance.svc.category.therapy_psychology": "Accompagnement psychologique",
  "finance.svc.category.therapy_speech": "Orthophonie",
  "finance.svc.category.second_apron": "Deuxième tablier",
  "finance.svc.category.parent_credit": "Crédit parent",
  "finance.svc.category.other": "Autres prestations",
  "finance.svc.category.registration": "Inscription",
  "finance.svc.cond.fullAnnual": "Paiement annuel avant le 30 juin",

  // Homework
  "homework.attachmentFallback": "Pièce jointe",

  // Messages
  "chat.conversations": "Conversations",
  "chat.selectConversation": "Sélectionnez une conversation",

  // Notifications
  "notifications.markedRead": "Marqué comme lu",
  "notifications.invalid": "Notification invalide.",

  // Profile — push notification preferences
  "profile.preferences": "Préférences",
  "profile.push.title": "Notifications push",
  "profile.push.unavailable": "Non disponible",
  "profile.push.enabled": "Notifications activées",
  "profile.push.disabled": "Notifications désactivées",
  "profile.push.enableFailed": "Impossible d'activer les notifications",

  // Documents
  "documents.uploadFailed": "Échec de l'envoi du fichier : {message}",
  "documents.fileInvalid": "Fichier invalide.",

  // Validation messages (zod schemas emit dictionary keys; the toast seam translates)
  "validation.note.tooLong": "La note ne peut pas dépasser 2000 caractères.",
  "validation.driveLink.invalid": "Le lien Google Drive n'est pas valide.",
  "validation.driveLink.notDrive": "Le lien doit pointer vers Google Drive.",
  "validation.absence.required": "Veuillez fournir une note, un fichier ou un lien Google Drive.",
  "validation.message.empty": "Le message ne peut pas être vide.",
  "validation.message.tooLong": "Le message ne peut pas dépasser 5000 caractères.",
  "validation.channelId.invalid": "Identifiant de canal invalide.",
  "validation.uuid.invalid": "Identifiant invalide.",
  "validation.file.tooBig": "Le fichier ne peut pas dépasser {max} Mo.",
  "validation.file.type": "Type de fichier non autorisé. Formats acceptés : PDF, PNG, JPEG, WebP.",

  // Common
  "common.send": "Envoyer",
};

const ar: Dict = {
  "student.dossier.view": "عرض الملف الكامل",
  "student.history.title": "المسار الدراسي السابق",
  "student.history.empty": "لا يوجد مسار دراسي مسجل.",
  "student.notes.title": "ملاحظات طبية وإدارية",
  "student.notes.empty": "لا توجد ملاحظات مسجلة.",
  "student.dossier.open": "الملف الكامل للتلميذ",
  "student.dossier.overview": "نظرة عامة",
  "student.dossier.enrollments": "التسجيلات المالية",
  "student.dossier.identity": "الهوية",
  "student.noClass": "لا توجد قسم مخصص",
  "student.age": "العمر",
  "student.history.previousYears": "السنوات السابقة",
  "student.history.firstYear": "هذا على الأرجح أول عام للتلميذ في المؤسسة.",
  "finance.payment.coverage": "تفاصيل التغطية",
  "finance.payment.coverage.hide": "إخفاء التغطية",
  "finance.payment.coverageLoadError": "تعذر تحميل التفاصيل.",
  "finance.payment.coverageDerivedHint": "التغطية معاد بناؤها من كشف الحساب (لا توجد تفصيل من الخادم لهذه الدفعة).",
  "finance.payment.expectedAmount": "المبلغ المتوقع (مفوتر)",
  "finance.payment.excessAmount": "فائض (رصيد الوالد)",
  "finance.payment.allocationsEmpty": "لم يتم العثور على تفاصيل التغطية.",
  "finance.installment.daysLeft": "{days} يوم",

  "app.name": "الإمتياز",
  "app.tagline": "فضاء الأولياء والتلاميذ",
  "app.loading": "جارٍ التحميل…",

  "auth.signin.title": "مرحبًا بكم في بوابة الإمتياز",
  "auth.signin.subtitle": "سجّلوا الدخول بحسابكم على Google للوصول إلى فضائكم.",
  "auth.signin.google": "تسجيل الدخول عبر Google",
  "auth.signin.secure": "دخول آمن عبر Supabase Auth",
  "auth.signin.help": "تحتاجون مساعدة؟ تواصلوا مع إدارة المدرسة.",
  "auth.signin.providerDisabled":
    "لم يُفعَّل تسجيل الدخول عبر Google في البوابة بعد. يرجى التواصل مع إدارة المدرسة لإتمام عملية التهيئة.",

  "activation.pending.title": "لم يتم تفعيل حسابكم بعد",
  "activation.pending.body":
    "تم إنشاء حسابكم بنجاح، إلا أنه في انتظار التفعيل من طرف إدارة المؤسسة. " +
    "بمجرد تفعيله، سيكون لديكم وصول تلقائي إلى معلوماتكم ومعلومات أبنائكم.",
  "activation.pending.contact": "يرجى الاتصال بإدارة المدرسة لإنهاء التفعيل.",
  "activation.pending.signout": "تسجيل الخروج",

  "nav.home": "الرئيسية",
  "nav.academic": "الدراسة",
  "nav.finance": "المدفوعات",
  "nav.messages": "الرسائل",
  "nav.profile": "الملف",
  "nav.notifications": "الإشعارات",
  "nav.attendance": "الغيابات",
  "nav.homework": "الواجبات",
  "nav.calendar": "الأجندة",
  "nav.timetable": "التوقيت",

  // Timetable (T-407 — the published weekly schedule)
  "timetable.empty": "لم يتم نشر جدول الحصص بعد. سيظهر هنا فور نشره من قبل المؤسسة.",
  "timetable.period": "ح{index}",
  "timetable.double": "حصة مزدوجة",
  "timetable.publishedHint": "الجدول الرسمي المنشور من قبل المؤسسة — كل تعديل يتم التحقق منه من قبل الإدارة قبل النشر.",
  "timetable.day.sunday": "الأحد",
  "timetable.day.monday": "الاثنين",
  "timetable.day.tuesday": "الثلاثاء",
  "timetable.day.wednesday": "الأربعاء",
  "timetable.day.thursday": "الخميس",
  "timetable.day.friday": "الجمعة",
  "timetable.day.saturday": "السبت",

  "finance.status.paid": "مدفوع",
  "finance.status.partial": "جزئي",
  "finance.status.unpaid": "غير مدفوع",
  "finance.status.overdue": "متأخر",
  "finance.status.pending": "قيد الانتظار",
  "finance.status.refunded": "مُسترجع",
  // T-056 / WEAK-020
  "finance.status.cancelled": "ملغى",
  "finance.status.pending_clearance": "قيد التحصيل",

  // Auth (complete)
  "auth.signin.configError.title": "إعداد ناقص",
  "auth.signin.configError.body":
    "البوابة غير متصلة بـ Supabase بعد. يرجى إعداد NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في ملف .env.local",
  "auth.callback.processing": "جارٍ التحقق…",
  "auth.callback.redirecting": "جارٍ إعادة التوجيه…",
  "auth.signout": "تسجيل الخروج",
  "auth.signout.confirm": "هل تريدون حقًا تسجيل الخروج؟",

  // Activation states (complete)
  "activation.suspended.title": "تم تعليق حسابكم",
  "activation.suspended.body":
    "تم تعليق الوصول إلى حسابكم من طرف الإدارة. لمزيد من المعلومات، يرجى الاتصال بالمؤسسة.",
  "activation.rejected.title": "تم رفض طلب الوصول",
  "activation.rejected.body":
    "تم رفض طلب الوصول إلى البوابة. لأي استفسار، يرجى الاتصال بالإدارة.",

  // Dashboard (complete)
  "dashboard.greeting.morning": "صباح الخير",
  "dashboard.greeting.afternoon": "مساء الخير",
  "dashboard.greeting.evening": "مساء الخير",
  "dashboard.section.children": "أبنائي",
  "dashboard.section.upcoming": "القادم",
  "dashboard.section.recent": "النشاط الأخير",
  "dashboard.section.balance": "رصيد الحساب",
  "dashboard.section.announcements": "الإعلانات",
  "dashboard.viewAll": "عرض الكل",
  "dashboard.empty.noChildren": "لا يوجد أبناء مرتبطون بحسابكم بعد.",
  "dashboard.empty.noUpcoming": "لا توجد أحداث قادمة.",
  "dashboard.empty.noUpcomingBody": "ستظهر هنا الأحداث التي تنشرها المؤسسة.",
  "dashboard.empty.noAnnouncements": "لا توجد إعلانات حالياً.",
  "dashboard.empty.noAnnouncementsBody":
    "ستظهر هنا إعلانات الإدارة الموجهة لأولياء الأمور.",

  // KPIs (complete)
  "kpi.balanceDue": "الرصيد المستحق",
  "kpi.nextInstallment": "القسط القادم",
  "kpi.attendanceRate": "نسبة الحضور",
  "kpi.averageGrade": "المعدل العام",
  "kpi.unreadMessages": "رسائل غير مقروءة",
  "kpi.upcomingEvents": "أحداث قادمة",

  // Student (complete)
  "student.select": "اختيار طفل",
  "student.class": "القسم",
  "student.level": "المستوى",
  "student.enrollmentStatus": "حالة التسجيل",
  "student.code": "الرقم التسلسلي",
  "student.attendance": "الحضور",
  "student.grades": "النقاط",
  "student.filiere": "الشعبة",
  "student.specialite": "التخصص",
  "student.gpa": "المعدل",
  "student.term": "الفصل",
  "academic.terms.all": "الكل",
  "student.subject": "المادة",
  "student.coefficient": "المعامل",
  "student.score": "النقطة",
  "student.average": "المعدل",
  "student.average.pending": "المعدل قيد الإصدار — يجب إدخال النقاط الثلاث (الفرض 1، الفرض 2، الامتحان)",
  "student.mark.cc": "المراقبة المستمرة",
  "student.rank": "الترتيب",
  "student.appreciation": "التقدير",
  "student.bulletin": "كشف النقاط",
  "student.bulletin.download": "تحميل كشف النقاط (PDF)",

  // Children detail (T-210)
  "children.title": "أطفالي",
  "children.identityNote": "معلومات تديرها الإدارة",
  "student.dateOfBirth": "تاريخ الميلاد",
  "student.gender": "الجنس",
  "student.gender.male": "ذكر",
  "student.gender.female": "أنثى",
  "student.gender.other": "آخر",
  "student.enrollmentDate": "تاريخ التسجيل",
  "student.yearsOld": "سنة",
  "student.status.inquiry": "استفسار",
  "student.status.quoted": "عرض سعر",
  "student.status.enrolled": "مسجل",
  "student.status.active": "نشط",
  "student.status.withdrawn": "منسحب",
  "student.status.graduated": "متخرج",

  // Children enrollments (T-211)
  "enrollments.title": "التسجيلات والخدمات",
  "enrollments.academicYear": "السنة الدراسية",
  "enrollments.services": "الخدمات المسجلة",
  "enrollments.servicesEmpty": "لا توجد خدمات مسجلة حالياً.",
  "enrollments.feeSchedule": "جدول الرسوم",
  "enrollments.feeScheduleEmpty": "لا يوجد جدول رسوم حالياً.",
  "enrollments.destination": "الوجهة",
  "enrollments.inactive": "غير نشط",
  "enrollments.service.club": "نادٍ",
  "enrollments.service.psychotherapy": "العلاج النفسي",
  "enrollments.service.rattrapage": "الدعم والاستدراك",

  // Attendance (complete)
  "attendance.title": "الغيابات والتأخيرات",
  "attendance.summary.present": "الحضور",
  "attendance.summary.excused": "غيابات مبررة",
  "attendance.summary.unexcused": "غيابات غير مبررة",
  "attendance.summary.late": "التأخيرات",
  "attendance.justification": "التبرير",
  "attendance.justification.note": "ملاحظة التبرير",
  "attendance.justification.uploaded": "تم تقديم المبرر",
  "attendance.justification.pending": "في انتظار التبرير",
  "attendance.empty": "لا توجد غيابات مسجلة.",

  // Homework (complete)
  "homework.title": "الواجبات",
  "homework.due": "موعد التسليم",
  "homework.subject": "المادة",
  "homework.overdue": "متأخر",
  "homework.dueToday": "مستحق اليوم",
  "homework.dueTomorrow": "مستحق غداً",
  "homework.empty": "لا توجد واجبات حالياً.",
  "homework.attachments": "المرفقات",
  "homework.locked": "مقفل",

  // Financial (complete)
  "finance.title": "المدفوعات والفواتير",
  "finance.balance.outstanding": "الرصيد المستحق",
  "finance.balance.outstandingHint": "المبلغ الإجمالي المتبقي للسداد",
  "finance.balance.overdue": "متأخر",
  "finance.balance.overdueHint":
    "أقساط متجاوزة الاستحقاق — يرجى الاتصال بالإدارة",
  "finance.balance.noOverdue": "لا يوجد تأخير",

  // T-405 — متابعة أقدمية الدين وسلوك الدفع (القواعد المالية §15)
  "finance.debtAging.title": "متابعة ملفكم",
  "finance.debtAging.originYear": "السنة الأصلية",
  "finance.debtAging.debtAge": "أقدمية الدين",
  "finance.debtAging.lastPayment": "آخر دفعة",
  "finance.debtAging.inactivity": "فترة الخمول",
  "finance.debtAging.subsequentPayments": "مدفوعات السنوات اللاحقة",
  "finance.debtAging.days": "يوم",
  "finance.debtAging.never": "أبداً",
  "finance.debtAging.yes": "نعم",
  "finance.debtAging.no": "لا",
  "finance.debtAging.status.green": "نشط / مسدد",
  "finance.debtAging.status.yellow": "يستدعي المتابعة",
  "finance.debtAging.status.orange": "تأخر مستمر",
  "finance.debtAging.status.red": "حرج",
  "finance.balance.paidHint": "إجمالي المحصّل حتى الآن",
  "finance.balance.pendingHint": "{amount} في انتظار المقاصة",
  "finance.balance.credit": "رصيد دائن",
  "finance.balance.creditHint": "دفعة مقدمة مسجلة لصالحكم",
  "finance.balance.noCredit": "لا توجد دفعة مقدمة",
  "finance.balance.settled": "الحساب مسوّى",
  "finance.installments": "الأقساط",
  "finance.payments": "المدفوعات",
  "finance.invoices": "الفواتير",
  "finance.receipts": "الإيصالات",
  "finance.installment.tranche": "القسط",
  "finance.installment.amount": "المبلغ",
  "finance.installment.due": "الاستحقاق",
  "finance.installment.paid": "مدفوع",
  "finance.installment.pending": "في الانتظار",
  "finance.installment.fullAnnual": "دفع سنوي",
  "finance.installment.remaining": "المتبقي",
  "finance.installment.status": "الحالة",
  "finance.payment.date": "التاريخ",
  "finance.payment.amount": "المبلغ",
  "finance.payment.method": "الطريقة",
  "finance.payment.method.cash": "نقداً",
  "finance.payment.method.check": "شيك",
  "finance.payment.method.transfer": "تحويل",
  "finance.payment.receipt": "إيصال",
  "finance.payment.viewReceipt": "عرض الإيصال",
  "finance.payment.proof": "إثبات الدفع",
  "finance.payment.proofTitle": "إثبات الدفع",
  "finance.payment.checkNumber": "رقم الشيك",
  "finance.payment.checkBank": "البنك",
  "finance.payment.clearance": "تاريخ الصرف",
  "finance.payment.transferRef": "المرجع",
  "finance.payment.transferBank": "البنك المرسل",
  "finance.payment.openProof": "فتح إثبات الدفع",
  "finance.empty.noPayments": "لا توجد مدفوعات مسجلة حالياً.",
  "finance.empty.noPaymentsBody": "ستظهر هنا المدفوعات التي يحصّلها المؤسسة.",
  "finance.empty.noInstallments": "لا توجد أقساط لعرضها.",
  "finance.empty.noInstallmentsBody":
    "لم تنشر المؤسسة بعد جدول أقساط لعائلتكم.",

  // Finance additions
  "finance.status.due": "الاستحقاق",
  "finance.adjustments": "التسويات",
  "finance.adjustment.title": "تسويات الحساب",
  "finance.adjustment.credit": "دائن",
  "finance.adjustment.debit": "مدين",
  "finance.adjustment.reason": "السبب",
  "finance.adjustment.amount": "المبلغ",
  "finance.adjustment.date": "التاريخ",
  "finance.adjustment.note": "ملاحظة الإدارة",
  "finance.adjustment.empty": "لا توجد تسويات مسجلة.",
  "finance.adjustment.emptyBody":
    "ستظهر هنا الخصومات والتسويات التي تمنحها الإدارة.",
  "finance.billing": "الفاتورة",
  "finance.billing.intro":
    "تفصيل السعر: ما تمت فوترته لكل طفل، خدمة بخدمة، وحالة الأقساط.",
  "finance.billing.perChild": "حسب الطفل",
  "finance.billing.perService": "حسب الخدمة",
  "finance.billing.items": "المواد والخدمات المشتركة",
  "finance.billing.engagedTotal": "الإجمالي الملتزم به",
  "finance.billing.year": "السنة الدراسية",
  "finance.billing.tranches": "جدول الأقساط",
  "finance.billing.noCharges": "لا توجد فوترة مسجلة.",
  "finance.billing.noChargesBody": "ستظهر هنا الخدمات المفوترة من المؤسسة.",
  "finance.billing.share": "من الإجمالي",
  "finance.billing.subtotal": "المجموع الفرعي",
  "finance.billing.familyItems": "العائلة — عناصر غير مرتبطة بطفل",
  "finance.billing.recon": "تسوية الحساب — كل دينار مُفسَّر",
  "finance.billing.recon.gross": "الإجمالي الخام المفوتر (المواد)",
  "finance.billing.recon.credit": "− خصومات / تخفيضات",
  "finance.billing.recon.debit": "+ زيادات / إلغاء خصم",
  "finance.billing.recon.net": "= الصافي المستحق",
  "finance.billing.recon.cleared": "− المدفوع المؤكد",
  "finance.billing.recon.pending": "− في الانتظار (شيك / تحويل)",
  "finance.billing.recon.remaining": "= المتبقي الصافي",
  "finance.billing.recon.bridge":
    "± جسر — كتابات أخرى (استردادات، مقابل كتابات)",
  "finance.billing.recon.server": "رصيد الحساب (المصدر: الخادم)",
  "finance.billing.elements": "عناصر",
  "finance.svc.detail": "التفصيل الكامل — كل ما يغطيه هذا السعر",
  "finance.svc.detail.hide": "إخفاء التفصيل",
  "finance.svc.year": "السنة المشمولة",
  "finance.svc.coverage": "التغطية حسب الطفل",
  "finance.svc.level": "المستوى",
  "finance.svc.cycle": "الطور",
  "finance.svc.class": "الفوج",
  "finance.svc.code": "الرقم",
  "finance.svc.catalog": "التعرفة الرسمية (الكتالوج)",
  "finance.svc.catalog.annual": "سنوي",
  "finance.svc.catalog.tranche": "القسط {n}",
  "finance.svc.catalog.dueMonth": "الاستحقاق {month}",
  "finance.svc.catalog.unit": "سعر الوحدة",
  "finance.svc.catalog.semester": "لكل فصل",
  "finance.svc.catalog.model": "الفوترة: {model}",
  "finance.svc.catalog.kind.tuition_by_grade": "الدراسة — تعرفة المستوى",
  "finance.svc.catalog.kind.transport_by_destination": "النقل — تعرفة المنطقة",
  "finance.svc.catalog.kind.registration_fee": "رسوم التسجيل",
  "finance.svc.catalog.kind.additional_service": "خدمة إضافية",
  "finance.svc.catalog.kind.complementary_service": "خدمة مكملة",
  "finance.svc.conditions": "الشروط المطبقة",
  "finance.svc.cond.pct": "{v} % من السعر",
  "finance.svc.cond.fixed": "{v} دج",
  "finance.svc.cond.deadline": "قبل {date}",
  "finance.svc.items": "العناصر المفوترة ({n})",
  "finance.svc.item.tranche": "القسط {n}",
  "finance.svc.item.plan": "الخطة: {plan}",
  "finance.svc.item.zone": "المنطقة: {zone}",
  "finance.svc.discounts": "الخصومات المطبقة",
  "finance.svc.discounts.none": "لا خصم مطبق على هذه الخدمة.",
  "finance.svc.plan": "جدول الدفع (إطار الأقساط)",
  "finance.svc.plan.none": "لا جدول أقساط — عرض سعر شامل.",
  "finance.svc.plan.due": "الاستحقاق",
  "finance.svc.construction": "تركيب السعر",
  "finance.svc.construction.catalog": "تعرفة الكتالوج (المرجع)",
  "finance.svc.construction.gross": "إجمالي المفوتر",
  "finance.svc.construction.debit": "+ إلغاء الخصمات / زيادات",
  "finance.svc.construction.discounts": "− الخصومات المطبقة",
  "finance.svc.construction.net": "= الصافي المفوتر",
  "finance.svc.construction.delta": "الفرق عن تعرفة الكتالوج",
  "finance.svc.construction.noCatalog": "لا مرجع كتالوج مطابق",
  "finance.svc.provenance": "المصدر",
  "finance.svc.provenance.excel_import": "استيراد Excel",
  "finance.svc.provenance.current_year_wizard": "إدخال السنة الجارية",
  "finance.svc.provenance.reconciliation": "مطابقة",
  "finance.svc.provenance.manual": "إدخال يدوي",
  "finance.svc.provenance.unknown": "أصل غير موثق",
  "finance.svc.provenance.run": "تشغيلة {id}",
  "finance.adjustment.reason.sibling_discount": "خصم الإخوة",
  "finance.adjustment.reason.staff_family": "عائلة الموظف",
  "finance.adjustment.reason.early_payment": "دفع مبكر",
  "finance.adjustment.reason.passage_palier": "تجاوز مستوى",
  "finance.adjustment.reason.seniority_5y": "أقدمية 5 سنوات",
  "finance.adjustment.reason.highest_average": "أعلى معدل",
  "finance.adjustment.reason.full_annual": "دفع سنوي",
  "finance.adjustment.reason.scholarship_replacement": "منحة استبدال",
  "finance.adjustment.reason.hardship": "صعوبة اجتماعية",
  "finance.adjustment.reason.correction": "تصحيح",
  "finance.adjustment.reason.other": "أخرى",
  "finance.receipt.download": "تحميل الإيصال (PDF)",
  "finance.statement.download": "تحميل كشف الحساب (PDF)",
  "finance.statement.generate": "إنشاء كشف",
  "finance.restrictions.title": "الوصول المالي مقيد",
  "finance.restrictions.body":
    "الوصول إلى بعض الوظائف المالية لحسابكم مقيد حالياً. " +
    "يرجى الاتصال بالإدارة لتسوية وضعيتكم.",

  // Ledger statement (source of truth — INV-1)
  "finance.ledger.title": "كشف الحساب",
  "finance.ledger.intro":
    "كشف حساب كامل: كل عملية فوترة ودفع وتسوية بترتيب زمني مع الرصيد التراكمي — تماماً كما تحسبه المؤسسة.",
  "finance.ledger.balance": "الرصيد",
  "finance.ledger.running": "الرصيد",
  "finance.ledger.empty.title": "لا توجد عمليات في كشف الحساب",
  "finance.ledger.empty.body":
    "ستظهر هنا عمليات حسابكم (الفوترة والمدفوعات والتسويات).",
  "finance.ledger.type.charge": "فوترة",
  "finance.ledger.type.payment": "دفع",
  "finance.ledger.type.adjustment": "تسوية",
  "finance.ledger.type.refund": "استرداد",
  "finance.ledger.type.reversal": "إلغاء",
  "finance.ledger.type.transfer": "تحويل",

  // Billing categories
  "finance.category.tuition": "التمدرس",
  "finance.category.transport": "النقل",
  "finance.category.canteen": "المطعم",
  "finance.category.uniform": "الزي",
  "finance.category.books": "الكتب",
  "finance.category.extracurricular": "الأنشطة",
  "finance.category.therapy_psychology": "متابعة نفسية",
  "finance.category.therapy_speech": "تخاطب",
  "finance.category.second_apron": "مريول ثانٍ",
  "finance.category.parent_credit": "رصيد العائلة",
  "finance.category.other": "أخرى",

  // Messages (complete)
  "messages.title": "الرسائل",
  "messages.empty": "لا توجد رسائل.",
  "messages.reply": "رد",
  "messages.send": "إرسال",
  "messages.placeholder": "اكتبوا رسالتكم…",
  "messages.fromSchool": "من المدرسة",
  "messages.convocation": "استدعاء",
  "messages.convocation.notice":
    "استدعاء رسمي من الإدارة — حضوركم مطلوب. يرجى التواصل مع الإدارة للتأكيد.",
  // T-149 (ADR-012) — the parent-initiated administration channel.
  "messages.contactAdmin": "التواصل مع الإدارة",
  "messages.contactAdmin.opening": "جارٍ فتح المحادثة…",
  "messages.contactAdmin.body":
    "اطرحوا أسئلتكم وتابعوا التقارير المدرسية مباشرة مع الإدارة.",
  "messages.contactAdmin.success": "تم فتح المحادثة مع الإدارة.",
  "messages.contactAdmin.error": "تعذر فتح المحادثة. يرجى إعادة المحاولة.",

  // Notifications (complete)
  "notifications.title": "الإشعارات",
  "notifications.empty": "لا توجد إشعارات.",
  "notifications.markAllRead": "تعليم الكل كمقروء",
  "notifications.priority.urgent": "عاجل",
  "notifications.priority.high": "مهم",
  "notifications.priority.medium": "عادي",
  "notifications.priority.low": "منخفض",

  // Profile (complete)
  "profile.title": "ملفي",
  "profile.account": "الحساب",
  "profile.email": "البريد الإلكتروني",
  "profile.name": "الاسم",
  "profile.phone": "الهاتف",
  "profile.role": "الدور",
  "profile.status": "الحالة",
  "profile.tenant": "المؤسسة",
  "profile.language": "اللغة",
  "profile.theme": "السمة",
  "profile.theme.dark": "داكنة",
  "profile.theme.light": "فاتحة",
  "profile.status.active": "نشط",
  "profile.status.pending": "قيد الانتظار",
  "profile.status.suspended": "معلّق",
  "profile.about": "حول",
  "profile.about.body":
    "تمنحكم هذه البوابة الوصول إلى معلومات أبنائكم: النقاط، الغيابات، المدفوعات، الإعلانات والاتصالات المدرسية. " +
    "تفعيل حسابكم تديره إدارة المؤسسة.",
  "profile.help": "المساعدة",
  "profile.help.contact": "الاتصال بالإدارة",
  "profile.version": "الإصدار",

  // Common (complete)
  "common.refresh": "تحديث",
  "common.retry": "إعادة المحاولة",
  "common.close": "إغلاق",
  "common.cancel": "إلغاء",
  "common.save": "حفظ",
  "common.delete": "حذف",
  "common.edit": "تعديل",
  "common.view": "عرض",
  "common.back": "رجوع",
  "common.search": "بحث",
  "common.error.title": "حدث خطأ",
  "common.error.network": "مشكلة في الاتصال. تحققوا من شبكتكم.",
  "common.error.unknown":
    "يرجى إعادة المحاولة. إذا استمرت المشكلة، اتصلوا بالإدارة.",
  "common.empty.title": "لا شيء لعرضه",
  "common.tryAgain": "إعادة المحاولة",
  "common.syncing": "جارٍ المزامنة…",
  "common.updated": "تم التحديث",
  "common.justNow": "الآن",

  // Calendar (complete)
  "calendar.title": "الأجندة",
  "calendar.today": "اليوم",
  "calendar.prevMonth": "الشهر السابق",
  "calendar.nextMonth": "الشهر التالي",
  "calendar.events": "الأحداث",
  "calendar.noEvents": "لا توجد أحداث في هذا اليوم",
  "calendar.eventType.exam": "امتحان",
  "calendar.eventType.holiday": "عطلة",
  "calendar.eventType.meeting": "اجتماع",
  "calendar.eventType.deadline": "موعد نهائي",
  "calendar.eventType.activity": "نشاط",
  "calendar.eventType.other": "أخرى",
  "calendar.filter": "تصفية",
  "calendar.filterAll": "الكل",
  "calendar.exams": "الامتحانات",
  "calendar.exam.title": "الامتحانات القادمة",
  "calendar.exam.room": "القاعة",
  "calendar.exam.invigilator": "المراقب",
  "calendar.exam.date": "التاريخ",
  "calendar.exam.time": "الوقت",
  "calendar.exam.empty": "لا توجد امتحانات مجدولة.",
  "calendar.allDay": "طوال اليوم",
  "calendar.eventType.payment": "دفع",

  // Activation code entry
  "activation.code.title": "لديّ رمز التفعيل",
  "activation.code.subtitle":
    "إذا سلمتكم المؤسسة رمز تفعيل من 6 أو 7 أرقام، " +
    "أدخلوه أدناه لربط حساب Google بملف عائلتكم.",
  "activation.code.input": "رمز التفعيل",
  "activation.code.submit": "تفعيل حسابي",
  "activation.code.submitting": "جارٍ التفعيل…",
  "activation.code.success.title": "تم تفعيل الحساب",
  "activation.code.success.body":
    "تم ربط حسابكم بملف عائلتكم. " +
    "ستقوم الإدارة بإنهاء التفعيل. يمكنكم تحديث هذه الصفحة.",
  "activation.code.error.invalid": "رمز التفعيل غير صالح أو مستخدم بالفعل.",
  "activation.code.error.expired":
    "انتهت صلاحية رمز التفعيل. يرجى طلب رمز جديد من الإدارة.",
  // T-153 (ACT-200) — precise bind-failure messages (mapped by the EF's error code).
  "activation.code.error.suspended":
    "هذا الحساب معلّق. يرجى التواصل مع إدارة المدرسة.",
  "activation.code.error.session":
    "الجلسة غير صالحة. يرجى تسجيل الدخول مجددًا ثم إعادة المحاولة.",
  "activation.code.error.bound":
    "ملف هذه العائلة مرتبط بحساب آخر. يرجى التواصل مع الإدارة.",
  "activation.code.error.generic": "تعذر تفعيل الحساب. يرجى إعادة المحاولة.",
  "activation.code.haveCode": "لديّ رمز تفعيل بالفعل",

  // T-413 — the student enrollment application form (pending screen)
  "application.title": "طلب تسجيل تلميذ",
  "application.subtitle": "جهّز ملف ابنك الآن — ستعالجه الإدارة مع طلب حسابك.",
  "application.student.firstName": "اسم التلميذ",
  "application.student.lastName": "لقب التلميذ",
  "application.student.dob": "تاريخ الميلاد",
  "application.student.gender": "الجنس",
  "application.student.male": "ولد",
  "application.student.female": "بنت",
  "application.student.level": "المستوى الدراسي المطلوب",
  "application.note": "رسالة إلى الإدارة (اختياري)",
  "application.notePlaceholder": "معلومات مفيدة للتسجيل…",
  "application.submit": "إرسال طلب التسجيل",
  "application.saving": "جارٍ الإرسال…",
  "application.saved.title": "تم تسجيل طلب التسجيل",
  "application.saved.body": "تم إرفاق طلبك بحسابك. ستعالجه الإدارة عند التفعيل.",
  "application.edit": "تعديل الطلب",
  "application.error.required": "اسم ولقب التلميذ إلزاميان.",
  "application.error.notSaved": "تعذّر تسجيل الطلب. أعد المحاولة أو اتصل بالإدارة.",
  "activation.code.dontHaveCode": "ليس لديّ رمز تفعيل",
  "activation.code.adminApproval": "طلب التفعيل من الإدارة",

  // Notification preferences
  "prefs.notifications.title": "تفضيلات الإشعارات",
  "prefs.notifications.body":
    "اختروا فئات الإشعارات التي ترغبون في استلامها " +
    "عبر Push و/أو داخل التطبيق.",
  "prefs.notifications.push": "Push",
  "prefs.notifications.inApp": "داخل التطبيق",
  "prefs.notifications.category.payment": "المدفوعات والاستحقاقات",
  "prefs.notifications.category.absence": "الغيابات والتبريرات",
  "prefs.notifications.category.message": "رسائل المؤسسة",
  "prefs.notifications.category.announcement": "الإعلانات العامة",
  "prefs.notifications.category.grade": "النقاط والكشوف",
  "prefs.notifications.category.homework": "الواجبات",
  "prefs.notifications.category.calendar": "أحداث التقويم",
  "prefs.notifications.category.account": "أمان الحساب",
  "prefs.notifications.category.system": "النظام",
  "prefs.notifications.saved": "تم حفظ التفضيلات",

  // Student documents
  "documents.title": "الوثائق",
  "documents.body":
    "قم بتحميل الوثائق التي تطلبها المؤسسة: " +
    "عقد الميلاد، الشهادة الطبية، العقد، إلخ.",
  "documents.upload": "تحميل وثيقة",
  "documents.kind.birth_certificate": "عقد الميلاد",
  "documents.kind.medical_certificate": "شهادة طبية",
  "documents.kind.contract": "العقد",
  "documents.kind.justification_letter": "رسالة تبرير",
  "documents.kind.id_photo": "صورة الهوية",
  "documents.kind.report_card": "كشف النقاط السابق",
  "documents.kind.other": "أخرى",
  "documents.file": "الملف",
  "documents.description": "الوصف (اختياري)",
  "documents.empty": "لا توجد وثائق مرفوعة حالياً.",
  "documents.uploadedAt": "تم التحميل في",
  "documents.delete": "حذف",
  "documents.delete.confirm": "حذف هذه الوثيقة؟",

  // Profile — edit contact info
  "profile.edit.title": "تعديل معلوماتي",
  "profile.edit.phone": "الهاتف الرئيسي",
  "profile.edit.secondaryPhone": "الهاتف الثانوي",
  "profile.edit.email": "البريد الإلكتروني",
  "profile.edit.address": "العنوان",
  "profile.edit.city": "المدينة",
  "profile.edit.postalCode": "الرمز البريدي",
  "profile.edit.occupation": "المهنة",
  "profile.edit.save": "حفظ",
  "profile.edit.cancel": "إلغاء",
  "profile.edit.saved": "تم تحديث المعلومات",

  // Profile — identity details (T-209)
  "profile.relationship": "صلة القرابة",
  "profile.relationship.father": "الأب",
  "profile.relationship.mother": "الأم",
  "profile.relationship.guardian": "الوصي",
  "profile.relationship.other": "آخر",
  "profile.nationalId": "الرقم الوطني للتعريف",
  "profile.memberSince": "عضو منذ",
  "profile.parentCode": "رمز الوالدين",

  // Notifications extras
  "notifications.dismiss": "تجاهل",
  "notifications.open": "فتح",
  "notifications.empty.unread": "لا توجد إشعارات غير مقروءة.",

  // Attendance — justification status
  "attendance.justification.status.none": "لا توجد تبرير",
  "attendance.justification.status.submitted": "تم تقديم التبرير",
  "attendance.justification.status.accepted": "تم قبول التبرير",
  "attendance.justification.status.rejected": "تم رفض التبرير",
  "attendance.justification.reviewedBy": "تمت المراجعة من الإدارة",
  "attendance.justification.reviewNote": "ملاحظة الإدارة",

  // Common — generic
  "common.upload": "تحميل",
  "common.download": "تنزيل",
  "common.yes": "نعم",
  "common.no": "لا",
  "common.loading": "جارٍ التحميل…",
  "common.success": "نجاح",
  "common.failed": "فشل",
  // ─── T-385 (I18N-500): full-coverage additions ───────────────────────────

  // App / nav chrome
  "app.portal": "بوابة الإمتياذ",
  "app.version": "v1.0.0 — portal",
  "nav.primary": "التنقل الرئيسي",

  // Error surfaces (global-error + error boundary)
  "error.generic.title": "حدث خطأ غير متوقع",
  "error.generic.message": "واجهت البوابة مشكلة.",
  "error.code": "الرمز:",
  "error.boundary.title": "حدث خطأ",
  "error.boundary.retryHint": "يرجى إعادة المحاولة.",

  // Offline / PWA / service-worker banners
  "offline.banner": "أنت غير متصل بالإنترنت. قد تكون البيانات المعروضة قديمة.",
  "pwa.install.title": "تثبيت البوابة",
  "pwa.install.body": "ادخل بشكل أسرع من شاشتك الرئيسية",
  "pwa.install.action": "تثبيت",
  "pwa.install.later": "لاحقًا",
  "sw.update.available": "يتوفر إصدار جديد من البوابة.",
  "sw.update.action": "تحديث",

  // Absence justification dialog
  "attendance.justification.dialogTitle": "تبرير غياب",
  "attendance.justification.dialogSubtitle":
    "قدّم ملاحظة توضيحية و/أو مبررًا (شهادة طبية، استدعاء، إلخ). ستقوم الإدارة بدراسة طلبك.",
  "attendance.justification.notePlaceholder": "مثال: تم تقديم شهادة طبية. الطفل مريض منذ…",
  "attendance.justification.attachmentLabel": "مرفق (PDF، صورة — بحد أقصى 10 ميغابايت)",
  "attendance.justification.chooseFile": "اختيار ملف",
  "attendance.justification.remove": "إزالة",
  "attendance.justification.driveLink": "رابط Google Drive (اختياري)",
  "attendance.justification.sent": "تم إرسال التبرير. ستقوم الإدارة بفحصه.",
  "attendance.justification.uploadFailed": "فشل إرسال الملف: {message}",
  "attendance.justifier": "تبرير هذا الغياب",

  // Academic view
  "academic.noStudent": "لم يتم اختيار أي تلميذ",
  "academic.grades.empty": "لا توجد درجات لهذه الفترة",
  "academic.bulletin.opened": "تم فتح كشف النقاط — استخدم نافذة الطباعة لحفظه بصيغة PDF",
  "academic.cc.horsMoyenne": "• خارج المعدل",

  // Auth
  "auth.or": "— أو —",

  // Financial — adjustments tab (render-layer mapping of the canonical FR output)
  "finance.adjust.pairLink": "↔ زوج ملغى:",
  "finance.adjust.badge.credit": "ائتمان / خصم",
  "finance.adjust.badge.debit": "مديونية / زيادة",
  "finance.adjust.provenance.documented": "موثّق",
  "finance.adjust.provenance.reversal_pair": "قيد عكسي",
  "finance.adjust.provenance.undocumented": "غير موثّق",
  "finance.adjust.meaning.reversal_pair":
    "قيد أُلغي بقيد عكسي بنفس المبلغ (إعادة استيراد محتملة أو تصحيح خطأ). الأثر الصافي على الرصيد: معدوم.",
  "finance.adjust.meaning.undocumented.credit":
    "قيد قديم بدون سبب (استيراد نظامي سابق للقيد 0069): خصم بسبب غير معروف — يجب تدقيقه.",
  "finance.adjust.meaning.undocumented.debit":
    "قيد قديم بدون سبب (استيراد نظامي سابق للقيد 0069): استعادة دين بسبب غير معروف — يجب تدقيقه.",
  "finance.adjust.meaning.documented.credit":
    "محتوى حقيقي: خصم أو تنزيل طبّقه موظف، بسبب موثّق — يخفّض الرصيد المستحق.",
  "finance.adjust.meaning.documented.debit":
    "محتوى حقيقي: زيادة أو إلغاء خصم طبّقه موظف، بسبب موثّق — يرفع الرصيد المستحق.",
  "finance.adjust.fallback.credit": "خصم / تنزيل سجّله النظام تلقائيًا (سبب غير موثّق)",
  "finance.adjust.fallback.debit": "تسوية / استعادة دين (قيد عكسي تلقائي، سبب غير موثّق)",

  // Financial — service categories (render-layer mapping of serviceLabelOf)
  "finance.svc.category.tuition": "الدراسة",
  "finance.svc.category.transport": "النقل",
  "finance.svc.category.canteen": "المطعم",
  "finance.svc.category.uniform": "الزي / اللباس الموحد",
  "finance.svc.category.books": "اللوازم والكتب",
  "finance.svc.category.extracurricular": "الأنشطة اللاصفية",
  "finance.svc.category.therapy_psychology": "المتابعة النفسية",
  "finance.svc.category.therapy_speech": "علاج النطق",
  "finance.svc.category.second_apron": "مريول ثانٍ",
  "finance.svc.category.parent_credit": "ائتمان ولي الأمر",
  "finance.svc.category.other": "خدمات أخرى",
  "finance.svc.category.registration": "التسجيل",
  "finance.svc.cond.fullAnnual": "الدفع السنوي قبل 30 جوان",

  // Homework
  "homework.attachmentFallback": "مرفق",

  // Messages
  "chat.conversations": "المحادثات",
  "chat.selectConversation": "اختر محادثة",

  // Notifications
  "notifications.markedRead": "تم وسم الإشعار كمقروء",
  "notifications.invalid": "إشعار غير صالح.",

  // Profile — push notification preferences
  "profile.preferences": "التفضيلات",
  "profile.push.title": "الإشعارات الفورية",
  "profile.push.unavailable": "غير متوفر",
  "profile.push.enabled": "تم تفعيل الإشعارات",
  "profile.push.disabled": "تم تعطيل الإشعارات",
  "profile.push.enableFailed": "تعذّر تفعيل الإشعارات",

  // Documents
  "documents.uploadFailed": "فشل إرسال الملف: {message}",
  "documents.fileInvalid": "ملف غير صالح.",

  // Validation messages (zod schemas emit dictionary keys; the toast seam translates)
  "validation.note.tooLong": "لا يمكن أن تتجاوز الملاحظة 2000 حرف.",
  "validation.driveLink.invalid": "رابط Google Drive غير صالح.",
  "validation.driveLink.notDrive": "يجب أن يشير الرابط إلى Google Drive.",
  "validation.absence.required": "يرجى تقديم ملاحظة أو ملف أو رابط Google Drive.",
  "validation.message.empty": "لا يمكن أن تكون الرسالة فارغة.",
  "validation.message.tooLong": "لا يمكن أن تتجاوز الرسالة 5000 حرف.",
  "validation.channelId.invalid": "معرّف القناة غير صالح.",
  "validation.uuid.invalid": "معرّف غير صالح.",
  "validation.file.tooBig": "لا يمكن أن يتجاوز الملف {max} ميغابايت.",
  "validation.file.type": "نوع ملف غير مسموح. الصيغ المقبولة: PDF، PNG، JPEG، WebP.",

  // Common
  "common.send": "إرسال",

  // T-187 network-error key (fr existed, ar was missing — parity gap fixed)
  "activation.code.error.network":
    "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم أعد المحاولة. " +
    "إذا استمرت المشكلة، اتصل بالإدارة.",
};

const en: Dict = {
  "student.dossier.view": "View complete file",
  "student.history.title": "Academic History",
  "student.history.empty": "No academic history.",
  "student.notes.title": "Medical Notes & Observations",
  "student.notes.empty": "No observations recorded.",
  "student.dossier.open": "Full student record",
  "student.dossier.overview": "Overview",
  "student.dossier.enrollments": "Financial Enrollments",
  "student.dossier.identity": "Identity",
  "student.noClass": "No class assigned",
  "student.age": "Age",
  "student.history.previousYears": "Previous years",
  "student.history.firstYear": "This is probably the student's first year at the school.",
  "finance.payment.coverage": "Coverage details",
  "finance.payment.coverage.hide": "Hide coverage",
  "finance.payment.coverageLoadError": "Could not load the details.",
  "finance.payment.coverageDerivedHint": "Coverage reconstructed from the statement (no server-side breakdown for this payment).",
  "finance.payment.expectedAmount": "Expected amount (billed)",
  "finance.payment.excessAmount": "Overpayment (parent credit)",
  "finance.payment.allocationsEmpty": "No detailed allocation found.",
  "finance.installment.daysLeft": "D-{days}",

  "app.name": "El-Imtiyaz",
  "app.tagline": "Parent & Student Portal",
  "app.loading": "Loading…",

  "auth.signin.title": "Welcome to the El-Imtiyaz Portal",
  "auth.signin.subtitle":
    "Sign in with your Google account to access your space.",
  "auth.signin.google": "Sign in with Google",
  "auth.signin.secure": "Secure sign-in via Supabase Auth",
  "auth.signin.help": "Need help? Contact your school's administration.",
  "auth.signin.providerDisabled":
    "Google sign-in is not enabled on the portal yet. Please contact the school administration to finish the setup.",

  "activation.pending.title": "Your account has not yet been activated",
  "activation.pending.body":
    "Your account was created successfully, but it is pending activation by the school administration. " +
    "Once activated, you will automatically have access to your information and your children's.",
  "activation.pending.contact":
    "Please contact your school's administration to finalize activation.",
  "activation.pending.signout": "Sign out",

  "nav.home": "Home",
  "nav.academic": "Academic",
  "nav.finance": "Payments",
  "nav.messages": "Messages",
  "nav.profile": "Profile",
  "nav.notifications": "Notifications",
  "nav.attendance": "Attendance",
  "nav.homework": "Homework",
  "nav.calendar": "Calendar",
  "nav.timetable": "Timetable",

  // Timetable (T-407 — the published weekly schedule)
  "timetable.empty": "No timetable has been published yet. It will appear here as soon as the school publishes it.",
  "timetable.period": "P{index}",
  "timetable.double": "Double period",
  "timetable.publishedHint": "Official timetable published by the school — every change is validated by the administration before publication.",
  "timetable.day.sunday": "Sunday",
  "timetable.day.monday": "Monday",
  "timetable.day.tuesday": "Tuesday",
  "timetable.day.wednesday": "Wednesday",
  "timetable.day.thursday": "Thursday",
  "timetable.day.friday": "Friday",
  "timetable.day.saturday": "Saturday",

  "calendar.title": "Calendar",
  "calendar.today": "Today",
  "calendar.prevMonth": "Previous month",
  "calendar.nextMonth": "Next month",
  "calendar.events": "Events",
  "calendar.noEvents": "No events on this day",
  "calendar.eventType.exam": "Exam",
  "calendar.eventType.holiday": "Holiday",
  "calendar.eventType.meeting": "Meeting",
  "calendar.eventType.deadline": "Deadline",
  "calendar.eventType.activity": "Activity",
  "calendar.eventType.other": "Other",
  "calendar.filter": "Filter",
  "calendar.filterAll": "All",
  "calendar.exams": "Exams",
  "calendar.exam.title": "Upcoming exams",
  "calendar.exam.room": "Room",
  "calendar.exam.invigilator": "Invigilator",
  "calendar.exam.date": "Date",
  "calendar.exam.time": "Time",
  "calendar.exam.empty": "No exams scheduled.",
  "calendar.allDay": "All day",

  "dashboard.greeting.morning": "Good morning",
  "dashboard.greeting.afternoon": "Good afternoon",
  "dashboard.greeting.evening": "Good evening",
  "dashboard.section.children": "My children",
  "dashboard.section.upcoming": "Upcoming",
  "dashboard.section.recent": "Recent activity",
  "dashboard.section.balance": "Account balance",
  "dashboard.section.announcements": "Announcements",
  "dashboard.viewAll": "View all",

  "kpi.balanceDue": "Balance due",
  "kpi.nextInstallment": "Next installment",
  "kpi.attendanceRate": "Attendance rate",
  "kpi.averageGrade": "General average",
  "kpi.unreadMessages": "Unread messages",
  "kpi.upcomingEvents": "Upcoming events",

  "finance.status.paid": "Paid",
  "finance.status.partial": "Partial",
  "finance.status.unpaid": "Unpaid",
  "finance.status.overdue": "Overdue",
  "finance.status.pending": "Pending",
  "finance.status.refunded": "Refunded",
  // T-056 / WEAK-020
  "finance.status.cancelled": "Cancelled",
  "finance.status.pending_clearance": "Pending clearance",

  // Auth (complete)
  "auth.signin.configError.title": "Missing configuration",
  "auth.signin.configError.body":
    "The portal is not yet connected to Supabase. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
  "auth.callback.processing": "Authenticating…",
  "auth.callback.redirecting": "Redirecting…",
  "auth.signout": "Sign out",
  "auth.signout.confirm": "Do you really want to sign out?",

  // Activation states (complete)
  "activation.suspended.title": "Your account has been suspended",
  "activation.suspended.body":
    "Access to your account has been suspended by the administration. For more information, please contact the establishment.",
  "activation.rejected.title": "Access request denied",
  "activation.rejected.body":
    "Your access request to the portal has been denied. For any questions, please contact the administration.",

  // Dashboard (complete)
  "dashboard.empty.noChildren": "No children are linked to your account yet.",
  "dashboard.empty.noUpcoming": "No upcoming events.",
  "dashboard.empty.noUpcomingBody":
    "Events published by the school will appear here.",
  "dashboard.empty.noAnnouncements": "No announcements at this time.",
  "dashboard.empty.noAnnouncementsBody":
    "Announcements from the administration for parents will appear here.",

  // Student (complete)
  "student.select": "Select a child",
  "student.class": "Class",
  "student.level": "Level",
  "student.enrollmentStatus": "Enrollment status",
  "student.code": "Student ID",
  "student.attendance": "Attendance",
  "student.grades": "Grades",
    "student.filiere": "Stream",
  "student.specialite": "Specialty",
"student.gpa": "GPA",
  "student.term": "Term",
  "academic.terms.all": "All",
  "student.subject": "Subject",
  "student.coefficient": "Coefficient",
  "student.score": "Score",
  "student.average": "Average",
  "student.average.pending": "Average pending — all three marks (test 1, test 2, exam) must be entered",
  "student.mark.cc": "C.Assessment",
  "student.rank": "Rank",
  "student.appreciation": "Appreciation",
  "student.bulletin": "Report card",
  "student.bulletin.download": "Download report card (PDF)",

  // Children detail (T-210)
  "children.title": "My children",
  "children.identityNote": "Information managed by the administration",
  "student.dateOfBirth": "Date of birth",
  "student.gender": "Gender",
  "student.gender.male": "Boy",
  "student.gender.female": "Girl",
  "student.gender.other": "Other",
  "student.enrollmentDate": "Enrollment date",
  "student.yearsOld": "years old",
  "student.status.inquiry": "Inquiry",
  "student.status.quoted": "Quoted",
  "student.status.enrolled": "Enrolled",
  "student.status.active": "Active",
  "student.status.withdrawn": "Withdrawn",
  "student.status.graduated": "Graduated",

  // Children enrollments (T-211)
  "enrollments.title": "Enrollments and services",
  "enrollments.academicYear": "School year",
  "enrollments.services": "Enrolled services",
  "enrollments.servicesEmpty": "No services enrolled yet (tuition excluded).",
  "enrollments.feeSchedule": "Fee schedule",
  "enrollments.feeScheduleEmpty": "No fee schedule yet.",
  "enrollments.destination": "Destination",
  "enrollments.inactive": "Inactive",
  "enrollments.service.club": "Club",
  "enrollments.service.psychotherapy": "Psychotherapy",
  "enrollments.service.rattrapage": "Catch-up tutoring",

  // Attendance (complete)
  "attendance.title": "Absences and tardiness",
  "attendance.summary.present": "Present",
  "attendance.summary.excused": "Excused absences",
  "attendance.summary.unexcused": "Unexcused absences",
  "attendance.summary.late": "Late arrivals",
  "attendance.justification": "Justification",
  "attendance.justification.note": "Justification note",
  "attendance.justification.uploaded": "Justification provided",
  "attendance.justification.pending": "Pending justification",
  "attendance.empty": "No absences recorded.",

  // Homework (complete)
  "homework.title": "Homework",
  "homework.due": "Due on",
  "homework.subject": "Subject",
  "homework.overdue": "Overdue",
  "homework.dueToday": "Due today",
  "homework.dueTomorrow": "Due tomorrow",
  "homework.empty": "No homework at this time.",
  "homework.attachments": "Attachments",
  "homework.locked": "Locked",

  // Financial (complete)
  "finance.title": "Payments & Invoices",
  "finance.balance.outstanding": "Balance due",
  "finance.balance.outstandingHint": "Total amount still to settle",
  "finance.balance.overdue": "Overdue",
  "finance.balance.overdueHint":
    "Past-due installments — please contact the administration",
  "finance.balance.noOverdue": "Nothing overdue",

  // T-405 — debt aging / payment-behavior status (financial-rules §15)
  "finance.debtAging.title": "Your account follow-up",
  "finance.debtAging.originYear": "Origin year",
  "finance.debtAging.debtAge": "Debt age",
  "finance.debtAging.lastPayment": "Last payment",
  "finance.debtAging.inactivity": "Inactivity",
  "finance.debtAging.subsequentPayments": "Later-year payments",
  "finance.debtAging.days": "days",
  "finance.debtAging.never": "Never",
  "finance.debtAging.yes": "Yes",
  "finance.debtAging.no": "No",
  "finance.debtAging.status.green": "Active / Settled",
  "finance.debtAging.status.yellow": "Needs attention",
  "finance.debtAging.status.orange": "Sustained arrears",
  "finance.debtAging.status.red": "Critical",
  "finance.balance.paidHint": "Total collected to date",
  "finance.balance.pendingHint": "{amount} awaiting clearance",
  "finance.balance.credit": "Account credit",
  "finance.balance.creditHint": "Advance registered in your favour",
  "finance.balance.noCredit": "No advance held",
  "finance.balance.settled": "Account settled",
  "finance.installments": "Installments",
  "finance.payments": "Payments",
  "finance.invoices": "Invoices",
  "finance.receipts": "Receipts",
  "finance.installment.tranche": "Installment",
  "finance.installment.amount": "Amount",
  "finance.installment.due": "Due date",
  "finance.installment.paid": "Paid",
  "finance.installment.pending": "Pending",
  "finance.installment.fullAnnual": "Full annual payment",
  "finance.installment.remaining": "Remaining",
  "finance.installment.status": "Status",
  "finance.payment.date": "Date",
  "finance.payment.amount": "Amount",
  "finance.payment.method": "Method",
  "finance.payment.method.cash": "Cash",
  "finance.payment.method.check": "Check",
  "finance.payment.method.transfer": "Transfer",
  "finance.payment.receipt": "Receipt",
  "finance.payment.viewReceipt": "View receipt",
  "finance.payment.proof": "Proof of payment",
  "finance.payment.proofTitle": "Proof of payment",
  "finance.payment.checkNumber": "Check no.",
  "finance.payment.checkBank": "Bank",
  "finance.payment.clearance": "Clearance date",
  "finance.payment.transferRef": "Reference",
  "finance.payment.transferBank": "Issuing bank",
  "finance.payment.openProof": "Open proof of payment",
  "finance.empty.noPayments": "No payments recorded yet.",
  "finance.empty.noPaymentsBody":
    "Payments collected by the school will appear here.",
  "finance.empty.noInstallments": "No installments to display.",
  "finance.empty.noInstallmentsBody":
    "The school has not published an installment plan for your family yet.",

  // Messages (complete)
  "messages.title": "Messages",
  "messages.empty": "No messages.",
  "messages.reply": "Reply",
  "messages.send": "Send",
  "messages.placeholder": "Write your message…",
  "messages.fromSchool": "From school",
  "messages.convocation": "Summons",
  "messages.convocation.notice":
    "Official summons from the administration — your attendance is required. Please contact the school office to confirm.",
  // T-149 (ADR-012) — the parent-initiated administration channel.
  "messages.contactAdmin": "Contact the administration",
  "messages.contactAdmin.opening": "Opening the conversation…",
  "messages.contactAdmin.body":
    "Ask your questions and review school reports directly with the administration.",
  "messages.contactAdmin.success":
    "Conversation with the administration opened.",
  "messages.contactAdmin.error":
    "Could not open the conversation. Please try again.",

  // Notifications (complete)
  "notifications.title": "Notifications",
  "notifications.empty": "No notifications.",
  "notifications.markAllRead": "Mark all as read",
  "notifications.priority.urgent": "Urgent",
  "notifications.priority.high": "High",
  "notifications.priority.medium": "Medium",
  "notifications.priority.low": "Low",

  // Profile (complete)
  "profile.title": "My profile",
  "profile.account": "Account",
  "profile.email": "Email",
  "profile.name": "Name",
  "profile.phone": "Phone",
  "profile.role": "Role",
  "profile.status": "Status",
  "profile.tenant": "Establishment",
  "profile.language": "Language",
  "profile.theme": "Theme",
  "profile.theme.dark": "Dark",
  "profile.theme.light": "Light",
  "profile.status.active": "Active",
  "profile.status.pending": "Pending",
  "profile.status.suspended": "Suspended",
  "profile.about": "About",
  "profile.about.body":
    "This portal gives you access to your children's information: grades, absences, payments, announcements, and school communications. " +
    "Account activation is managed by the establishment's administration.",
  "profile.help": "Support",
  "profile.help.contact": "Contact administration",
  "profile.version": "Version",

  // Common (complete)
  "common.refresh": "Refresh",
  "common.retry": "Retry",
  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.view": "View",
  "common.back": "Back",
  "common.search": "Search",
  "common.error.title": "An error occurred",
  "common.error.network": "Connection problem. Check your network.",
  "common.error.unknown":
    "Please try again. If the problem persists, contact the administration.",
  "common.empty.title": "Nothing to display",
  "common.tryAgain": "Try again",
  "common.syncing": "Syncing…",
  "common.updated": "Updated",
  "common.justNow": "Just now",

  // Finance additions
  "finance.status.due": "Due",
  "finance.adjustments": "Adjustments",
  "finance.adjustment.title": "Account adjustments",
  "finance.adjustment.reason": "Reason",
  "finance.adjustment.credit": "Credit",
  "finance.adjustment.debit": "Debit",
  "finance.adjustment.amount": "Amount",
  "finance.adjustment.date": "Date",
  "finance.adjustment.note": "Admin note",
  "finance.adjustment.empty": "No adjustments recorded.",
  "finance.adjustment.emptyBody":
    "Discounts and regularizations granted by the administration will appear here.",
  "finance.billing": "Billing",
  "finance.billing.intro":
    "Price breakdown: what was billed per child, service by service, and where the installments stand.",
  "finance.billing.perChild": "Per child",
  "finance.billing.perService": "Per service",
  "finance.billing.items": "Items & subscribed services",
  "finance.billing.engagedTotal": "Total engaged",
  "finance.billing.year": "School year",
  "finance.billing.tranches": "Installment schedule",
  "finance.billing.noCharges": "No billing recorded.",
  "finance.billing.noChargesBody":
    "Services billed by the school will appear here.",
  "finance.billing.share": "of total",
  "finance.billing.subtotal": "Subtotal",
  "finance.billing.familyItems": "Family — items not tied to a child",
  "finance.billing.recon": "Account reconciliation — every dinar explained",
  "finance.billing.recon.gross": "Gross billed (items)",
  "finance.billing.recon.credit": "− Discounts / deductions",
  "finance.billing.recon.debit": "+ Surcharges / discount reversals",
  "finance.billing.recon.net": "= Net due",
  "finance.billing.recon.cleared": "− Cleared payments",
  "finance.billing.recon.pending": "− Pending (cheque / transfer)",
  "finance.billing.recon.remaining": "= Net remaining",
  "finance.billing.recon.bridge":
    "± Bridge — other entries (refunds, counter-passes)",
  "finance.billing.recon.server": "Account balance (source: server)",
  "finance.billing.elements": "items",
  "finance.svc.detail": "Full detail — everything this price covers",
  "finance.svc.detail.hide": "Hide detail",
  "finance.svc.year": "Year covered",
  "finance.svc.coverage": "Per-child coverage",
  "finance.svc.level": "Level",
  "finance.svc.cycle": "Cycle",
  "finance.svc.class": "Class",
  "finance.svc.code": "Student code",
  "finance.svc.catalog": "Official catalog price",
  "finance.svc.catalog.annual": "Annual",
  "finance.svc.catalog.tranche": "Installment {n}",
  "finance.svc.catalog.dueMonth": "due {month}",
  "finance.svc.catalog.unit": "Unit price",
  "finance.svc.catalog.semester": "Per semester",
  "finance.svc.catalog.model": "Billing: {model}",
  "finance.svc.catalog.kind.tuition_by_grade": "Tuition — grade price",
  "finance.svc.catalog.kind.transport_by_destination": "Transport — zone price",
  "finance.svc.catalog.kind.registration_fee": "Registration fee",
  "finance.svc.catalog.kind.additional_service": "Additional service",
  "finance.svc.catalog.kind.complementary_service": "Complementary service",
  "finance.svc.conditions": "Applicable conditions",
  "finance.svc.cond.pct": "{v} % of the price",
  "finance.svc.cond.fixed": "{v} DA",
  "finance.svc.cond.deadline": "before {date}",
  "finance.svc.items": "Billed items ({n})",
  "finance.svc.item.tranche": "Installment {n}",
  "finance.svc.item.plan": "Plan: {plan}",
  "finance.svc.item.zone": "Zone: {zone}",
  "finance.svc.discounts": "Applied discounts",
  "finance.svc.discounts.none": "No discount applied to this service.",
  "finance.svc.plan": "Payment schedule (installment framework)",
  "finance.svc.plan.none": "No physical schedule — lump-sum quote.",
  "finance.svc.plan.due": "Due",
  "finance.svc.construction": "Price construction",
  "finance.svc.construction.catalog": "Catalog price (reference)",
  "finance.svc.construction.gross": "Gross billed quote",
  "finance.svc.construction.debit": "+ Discount cancellations / surcharges",
  "finance.svc.construction.discounts": "− Applied discounts",
  "finance.svc.construction.net": "= Net billed",
  "finance.svc.construction.delta": "Delta vs catalog",
  "finance.svc.construction.noCatalog": "No mappable catalog reference",
  "finance.svc.provenance": "Provenance",
  "finance.svc.provenance.excel_import": "Excel import",
  "finance.svc.provenance.current_year_wizard": "Current-year entry",
  "finance.svc.provenance.reconciliation": "Reconciliation",
  "finance.svc.provenance.manual": "Manual entry",
  "finance.svc.provenance.unknown": "Undocumented origin",
  "finance.svc.provenance.run": "run {id}",
  "finance.adjustment.reason.sibling_discount": "Sibling discount",
  "finance.adjustment.reason.staff_family": "Staff family",
  "finance.adjustment.reason.early_payment": "Early payment",
  "finance.adjustment.reason.passage_palier": "Level promotion",
  "finance.adjustment.reason.seniority_5y": "5-year seniority",
  "finance.adjustment.reason.highest_average": "Highest average",
  "finance.adjustment.reason.full_annual": "Full annual payment",
  "finance.adjustment.reason.scholarship_replacement":
    "Scholarship replacement",
  "finance.adjustment.reason.hardship": "Hardship",
  "finance.adjustment.reason.correction": "Correction",
  "finance.adjustment.reason.other": "Other",
  "finance.receipt.download": "Download receipt (PDF)",
  "finance.statement.download": "Download account statement (PDF)",
  "finance.statement.generate": "Generate statement",
  "finance.restrictions.title": "Financial access restricted",
  "finance.restrictions.body":
    "Access to some financial features on your account is currently restricted. " +
    "Please contact the administration to regularize your situation.",

  // Ledger statement (source of truth — INV-1)
  "finance.ledger.title": "Statement",
  "finance.ledger.intro":
    "Complete account statement: every charge, payment and adjustment in chronological order with a running balance — exactly as the school computes it.",
  "finance.ledger.balance": "balance",
  "finance.ledger.running": "Balance",
  "finance.ledger.empty.title": "No statement entries",
  "finance.ledger.empty.body":
    "Your account activity (charges, payments, adjustments) will appear here.",
  "finance.ledger.type.charge": "Charge",
  "finance.ledger.type.payment": "Payment",
  "finance.ledger.type.adjustment": "Adjustment",
  "finance.ledger.type.refund": "Refund",
  "finance.ledger.type.reversal": "Reversal",
  "finance.ledger.type.transfer": "Transfer",

  // Billing categories
  "finance.category.tuition": "Tuition",
  "finance.category.transport": "Transport",
  "finance.category.canteen": "Canteen",
  "finance.category.uniform": "Uniform",
  "finance.category.books": "Books",
  "finance.category.extracurricular": "Activities",
  "finance.category.therapy_psychology": "Psychological support",
  "finance.category.therapy_speech": "Speech therapy",
  "finance.category.second_apron": "Second apron",
  "finance.category.parent_credit": "Family credit",
  "finance.category.other": "Other",
  "calendar.eventType.payment": "Payment",

  // Activation code entry
  "activation.code.title": "I have an activation code",
  "activation.code.subtitle":
    "If the school gave you a 6 or 7 digit activation code, " +
    "enter it below to link your Google account to your family record.",
  "activation.code.input": "Activation code",
  "activation.code.submit": "Activate my account",
  "activation.code.submitting": "Activating…",
  "activation.code.success.title": "Account activated",
  "activation.code.success.body":
    "Your account is now linked to your family record. " +
    "The administration will finalize the activation. You can refresh this page.",
  "activation.code.error.invalid": "Invalid or already-used activation code.",
  "activation.code.error.expired":
    "This activation code has expired. Please request a new one from the administration.",
  // T-153 (ACT-200) — precise bind-failure messages (mapped by the EF's error code).
  "activation.code.error.suspended":
    "This account is suspended. Please contact the school administration.",
  "activation.code.error.session":
    "Invalid session. Please sign in again and retry.",
  "activation.code.error.bound":
    "This family profile is already linked to another account. Please contact the school administration.",
  "activation.code.error.generic":
    "Could not activate the account. Please try again.",
  "activation.code.haveCode": "I already have an activation code",

  // T-413 — the student enrollment application form (pending screen)
  "application.title": "Student enrollment application",
  "application.subtitle": "Prepare your child's file now — the administration will process it with your account request.",
  "application.student.firstName": "Student first name",
  "application.student.lastName": "Student last name",
  "application.student.dob": "Date of birth",
  "application.student.gender": "Gender",
  "application.student.male": "Boy",
  "application.student.female": "Girl",
  "application.student.level": "Requested grade level",
  "application.note": "Message to the administration (optional)",
  "application.notePlaceholder": "Useful information for the enrollment…",
  "application.submit": "Send the enrollment application",
  "application.saving": "Sending…",
  "application.saved.title": "Enrollment application saved",
  "application.saved.body": "Your application has been attached to your account. The administration will process it during activation.",
  "application.edit": "Edit the application",
  "application.error.required": "The student's first and last names are required.",
  "application.error.notSaved": "The application could not be saved. Retry or contact the administration.",
  "activation.code.dontHaveCode": "I don't have an activation code",
  "activation.code.adminApproval": "Request activation by the administration",

  // Notification preferences
  "prefs.notifications.title": "Notification preferences",
  "prefs.notifications.body":
    "Choose which notification categories you want to receive " +
    "via push and/or in the app.",
  "prefs.notifications.push": "Push",
  "prefs.notifications.inApp": "In-app",
  "prefs.notifications.category.payment": "Payments & due dates",
  "prefs.notifications.category.absence": "Absences & justifications",
  "prefs.notifications.category.message": "Messages from the school",
  "prefs.notifications.category.announcement": "General announcements",
  "prefs.notifications.category.grade": "Grades & report cards",
  "prefs.notifications.category.homework": "Homework",
  "prefs.notifications.category.calendar": "Calendar events",
  "prefs.notifications.category.account": "Account security",
  "prefs.notifications.category.system": "System",
  "prefs.notifications.saved": "Preferences saved",

  // Student documents
  "documents.title": "Documents",
  "documents.body":
    "Upload the documents requested by the school: " +
    "birth certificate, medical certificate, contract, etc.",
  "documents.upload": "Upload a document",
  "documents.kind.birth_certificate": "Birth certificate",
  "documents.kind.medical_certificate": "Medical certificate",
  "documents.kind.contract": "Contract",
  "documents.kind.justification_letter": "Justification letter",
  "documents.kind.id_photo": "ID photo",
  "documents.kind.report_card": "Previous report card",
  "documents.kind.other": "Other",
  "documents.file": "File",
  "documents.description": "Description (optional)",
  "documents.empty": "No documents uploaded yet.",
  "documents.uploadedAt": "Uploaded on",
  "documents.delete": "Delete",
  "documents.delete.confirm": "Delete this document?",

  // Profile — edit contact info
  "profile.edit.title": "Edit my information",
  "profile.edit.phone": "Primary phone",
  "profile.edit.secondaryPhone": "Secondary phone",
  "profile.edit.email": "Email",
  "profile.edit.address": "Address",
  "profile.edit.city": "City",
  "profile.edit.postalCode": "Postal code",
  "profile.edit.occupation": "Occupation",
  "profile.edit.save": "Save",
  "profile.edit.cancel": "Cancel",
  "profile.edit.saved": "Information updated",

  // Profile — identity details (T-209)
  "profile.relationship": "Relationship",
  "profile.relationship.father": "Father",
  "profile.relationship.mother": "Mother",
  "profile.relationship.guardian": "Guardian",
  "profile.relationship.other": "Other",
  "profile.nationalId": "National ID number",
  "profile.memberSince": "Member since",
  "profile.parentCode": "Parent code",

  // Notifications extras
  "notifications.dismiss": "Dismiss",
  "notifications.open": "Open",
  "notifications.empty.unread": "No unread notifications.",

  // Attendance — justification status
  "attendance.justification.status.none": "No justification",
  "attendance.justification.status.submitted": "Justification submitted",
  "attendance.justification.status.accepted": "Justification accepted",
  "attendance.justification.status.rejected": "Justification rejected",
  "attendance.justification.reviewedBy": "Reviewed by the administration",
  "attendance.justification.reviewNote": "Admin note",

  // Common — generic
  "common.upload": "Upload",
  "common.download": "Download",
  "common.yes": "Yes",
  "common.no": "No",
  "common.loading": "Loading…",
  "common.success": "Success",
  "common.failed": "Failed",
  // ─── T-385 (I18N-500): full-coverage additions ───────────────────────────

  // App / nav chrome
  "app.portal": "El-Imtiyaz Portal",
  "app.version": "v1.0.0 — portal",
  "nav.primary": "Primary navigation",

  // Error surfaces (global-error + error boundary)
  "error.generic.title": "An unexpected error occurred",
  "error.generic.message": "The portal encountered a problem.",
  "error.code": "Code:",
  "error.boundary.title": "Something went wrong",
  "error.boundary.retryHint": "Please try again.",

  // Offline / PWA / service-worker banners
  "offline.banner": "You are offline. Displayed data may be outdated.",
  "pwa.install.title": "Install the portal",
  "pwa.install.body": "Access faster from your home screen",
  "pwa.install.action": "Install",
  "pwa.install.later": "Later",
  "sw.update.available": "A new version of the portal is available.",
  "sw.update.action": "Update",

  // Absence justification dialog
  "attendance.justification.dialogTitle": "Justify an absence",
  "attendance.justification.dialogSubtitle":
    "Provide an explanatory note and/or a supporting document (medical certificate, summons, etc.). The administration will review your request.",
  "attendance.justification.notePlaceholder": "E.g.: Medical certificate provided. Child sick since…",
  "attendance.justification.attachmentLabel": "Attachment (PDF, image — max 10 MB)",
  "attendance.justification.chooseFile": "Choose a file",
  "attendance.justification.remove": "Remove",
  "attendance.justification.driveLink": "Google Drive link (optional)",
  "attendance.justification.sent": "Justification sent. The administration will review it.",
  "attendance.justification.uploadFailed": "File upload failed: {message}",
  "attendance.justifier": "Justify this absence",

  // Academic view
  "academic.noStudent": "No student selected",
  "academic.grades.empty": "No grades for this period",
  "academic.bulletin.opened": "Report card opened — use the print dialog to save it as PDF",
  "academic.cc.horsMoyenne": "• not counted in the average",

  // Auth
  "auth.or": "— or —",

  // Financial — adjustments tab (render-layer mapping of the canonical FR output)
  "finance.adjust.pairLink": "↔ Cancelled pair:",
  "finance.adjust.badge.credit": "Credit / Deduction",
  "finance.adjust.badge.debit": "Debit / Surcharge",
  "finance.adjust.provenance.documented": "Documented",
  "finance.adjust.provenance.reversal_pair": "Reversal pair",
  "finance.adjust.provenance.undocumented": "Undocumented",
  "finance.adjust.meaning.reversal_pair":
    "Entry cancelled by an opposite entry of the same amount (probable re-import or error correction). Net effect on the balance: none.",
  "finance.adjust.meaning.undocumented.credit":
    "Legacy entry without a reason (system import predating constraint 0069): deduction of unknown cause — to be audited.",
  "finance.adjust.meaning.undocumented.debit":
    "Legacy entry without a reason (system import predating constraint 0069): debt restoration of unknown cause — to be audited.",
  "finance.adjust.meaning.documented.credit":
    "Real content: discount or deduction applied by an operator, documented reason — reduces the balance due.",
  "finance.adjust.meaning.documented.debit":
    "Real content: surcharge or discount cancellation applied by an operator, documented reason — increases the balance due.",
  "finance.adjust.fallback.credit": "Deduction / discount recorded automatically by the system (undocumented reason)",
  "finance.adjust.fallback.debit": "Regularization / debt restoration (automatic reversal, undocumented reason)",

  // Financial — service categories (render-layer mapping of serviceLabelOf)
  "finance.svc.category.tuition": "Tuition",
  "finance.svc.category.transport": "Transport",
  "finance.svc.category.canteen": "Canteen",
  "finance.svc.category.uniform": "Uniform",
  "finance.svc.category.books": "Supplies & Books",
  "finance.svc.category.extracurricular": "Extracurricular activities",
  "finance.svc.category.therapy_psychology": "Psychological support",
  "finance.svc.category.therapy_speech": "Speech therapy",
  "finance.svc.category.second_apron": "Second apron",
  "finance.svc.category.parent_credit": "Parent credit",
  "finance.svc.category.other": "Other services",
  "finance.svc.category.registration": "Registration",
  "finance.svc.cond.fullAnnual": "Annual payment before June 30",

  // Homework
  "homework.attachmentFallback": "Attachment",

  // Messages
  "chat.conversations": "Conversations",
  "chat.selectConversation": "Select a conversation",

  // Notifications
  "notifications.markedRead": "Marked as read",
  "notifications.invalid": "Invalid notification.",

  // Profile — push notification preferences
  "profile.preferences": "Preferences",
  "profile.push.title": "Push notifications",
  "profile.push.unavailable": "Not available",
  "profile.push.enabled": "Notifications enabled",
  "profile.push.disabled": "Notifications disabled",
  "profile.push.enableFailed": "Could not enable notifications",

  // Documents
  "documents.uploadFailed": "File upload failed: {message}",
  "documents.fileInvalid": "Invalid file.",

  // Validation messages (zod schemas emit dictionary keys; the toast seam translates)
  "validation.note.tooLong": "The note cannot exceed 2000 characters.",
  "validation.driveLink.invalid": "The Google Drive link is not valid.",
  "validation.driveLink.notDrive": "The link must point to Google Drive.",
  "validation.absence.required": "Please provide a note, a file, or a Google Drive link.",
  "validation.message.empty": "The message cannot be empty.",
  "validation.message.tooLong": "The message cannot exceed 5000 characters.",
  "validation.channelId.invalid": "Invalid channel identifier.",
  "validation.uuid.invalid": "Invalid identifier.",
  "validation.file.tooBig": "The file cannot exceed {max} MB.",
  "validation.file.type": "Unauthorized file type. Accepted formats: PDF, PNG, JPEG, WebP.",

  // Common
  "common.send": "Send",

  // T-187 network-error key (fr existed, en was missing — parity gap fixed)
  "activation.code.error.network":
    "Unable to reach the server. Check your internet connection and try again. " +
    "If the problem persists, contact the administration.",
};

export const dictionaries: Record<Locale, Dict> = { fr, ar, en };

/** Translate a key. Falls back to French, then to the key itself. */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  let s = dictionaries[locale]?.[key] ?? dictionaries.fr[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

export const isRtl = (locale: Locale): boolean => locale === "ar";
