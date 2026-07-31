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

export type Locale = "fr" | "ar" | "en";

export const LOCALES: Locale[] = ["fr", "ar", "en"];
export const DEFAULT_LOCALE: Locale = "fr";

type Dict = Record<string, string>;

const fr: Dict = {
  // App
  "app.name": "El-Imtiyaz",
  "app.tagline": "Espace Parent & Élève",
  "app.loading": "Chargement…",

  // Auth
  "auth.signin.title": "Bienvenue sur le portail El-Imtiyaz",
  "auth.signin.subtitle": "Connectez-vous avec votre compte Google pour accéder à votre espace.",
  "auth.signin.google": "Se connecter avec Google",
  "auth.signin.secure": "Connexion sécurisée via Supabase Auth",
  "auth.signin.help": "Besoin d'aide ? Contactez l'administration de l'école.",
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
  "activation.pending.contact": "Veuillez contacter l'administration de votre école pour finaliser l'activation.",
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
  "dashboard.empty.noChildren": "Aucun enfant n'est encore rattaché à votre compte.",
  "dashboard.empty.noUpcoming": "Aucun événement à venir.",
  "dashboard.empty.noAnnouncements": "Aucune annonce pour le moment.",

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
  "student.gpa": "Moyenne",
  "student.term": "Trimestre",
  "student.subject": "Matière",
  "student.coefficient": "Coefficient",
  "student.score": "Note",
  "student.average": "Moyenne",
  "student.rank": "Rang",
  "student.appreciation": "Appréciation",
  "student.bulletin": "Bulletin",
  "student.bulletin.download": "Télécharger le bulletin (PDF)",

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
  "finance.balance.credit": "Crédit sur compte",
  "finance.balance.settled": "Compte à jour",
  "finance.installments": "Échéances (Tranches)",
  "finance.payments": "Historique des paiements",
  "finance.invoices": "Factures",
  "finance.receipts": "Reçus",
  "finance.installment.tranche": "Tranche",
  "finance.installment.amount": "Montant",
  "finance.installment.due": "Échéance",
  "finance.installment.paid": "Payé",
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
  "finance.empty.noPayments": "Aucun paiement enregistré pour le moment.",
  "finance.empty.noInstallments": "Aucune échéance à afficher.",
  "finance.status.paid": "Payé",
  "finance.status.partial": "Partiel",
  "finance.status.unpaid": "Non payé",
  "finance.status.overdue": "En retard",
  "finance.status.pending": "En attente",
  "finance.status.refunded": "Remboursé",

  // Messages
  "messages.title": "Messages",
  "messages.empty": "Aucun message.",
  "messages.reply": "Répondre",
  "messages.send": "Envoyer",
  "messages.placeholder": "Écrivez votre message…",
  "messages.fromSchool": "De l'école",
  "messages.convocation": "Convocation",

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
  "common.error.unknown": "Veuillez réessayer. Si le problème persiste, contactez l'administration.",
  "common.empty.title": "Rien à afficher",
  "common.tryAgain": "Réessayer",
  "common.syncing": "Synchronisation…",
  "common.updated": "Mis à jour",
  "common.justNow": "À l'instant",
};

const ar: Dict = {
  "app.name": "الإمتياز",
  "app.tagline": "فضاء الأولياء والتلاميذ",
  "app.loading": "جارٍ التحميل…",

  "auth.signin.title": "مرحبًا بكم في بوابة الإمتياز",
  "auth.signin.subtitle": "سجّلوا الدخول بحسابكم على Google للوصول إلى فضائكم.",
  "auth.signin.google": "تسجيل الدخول عبر Google",
  "auth.signin.secure": "دخول آمن عبر Supabase Auth",
  "auth.signin.help": "تحتاجون مساعدة؟ تواصلوا مع إدارة المدرسة.",
  "auth.callback.processing": "جارٍ التحقق…",
  "auth.callback.redirecting": "جارٍ إعادة التوجيه…",
  "auth.signout": "تسجيل الخروج",
  "auth.signout.confirm": "هل تريدون حقًا تسجيل الخروج؟",

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

  "dashboard.greeting.morning": "صباح الخير",
  "dashboard.greeting.afternoon": "مساء الخير",
  "dashboard.greeting.evening": "مساء الخير",
  "dashboard.section.children": "أبنائي",
  "dashboard.section.upcoming": "القادم",
  "dashboard.section.recent": "النشاط الأخير",
  "dashboard.section.balance": "رصيد الحساب",
  "dashboard.section.announcements": "الإعلانات",
  "dashboard.viewAll": "عرض الكل",

  "kpi.balanceDue": "الرصيد المستحق",
  "kpi.nextInstallment": "القسط القادم",
  "kpi.attendanceRate": "نسبة الحضور",
  "kpi.averageGrade": "المعدل العام",
  "kpi.unreadMessages": "رسائل غير مقروءة",
  "kpi.upcomingEvents": "أحداث قادمة",

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

  "finance.status.paid": "مدفوع",
  "finance.status.partial": "جزئي",
  "finance.status.unpaid": "غير مدفوع",
  "finance.status.overdue": "متأخر",
  "finance.status.pending": "قيد الانتظار",
  "finance.status.refunded": "مُسترجع",

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
  "dashboard.empty.noAnnouncements": "لا توجد إعلانات حالياً.",

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
  "student.gpa": "المعدل",
  "student.term": "الفصل",
  "student.subject": "المادة",
  "student.coefficient": "المعامل",
  "student.score": "النقطة",
  "student.average": "المعدل",
  "student.rank": "الترتيب",
  "student.appreciation": "التقدير",
  "student.bulletin": "كشف النقاط",
  "student.bulletin.download": "تحميل كشف النقاط (PDF)",

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
  "finance.balance.credit": "رصيد دائن",
  "finance.balance.settled": "الحساب مسوّى",
  "finance.installments": "الأقساط (Tranches)",
  "finance.payments": "سجل المدفوعات",
  "finance.invoices": "الفواتير",
  "finance.receipts": "الإيصالات",
  "finance.installment.tranche": "القسط",
  "finance.installment.amount": "المبلغ",
  "finance.installment.due": "الاستحقاق",
  "finance.installment.paid": "مدفوع",
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
  "finance.empty.noPayments": "لا توجد مدفوعات مسجلة حالياً.",
  "finance.empty.noInstallments": "لا توجد أقساط لعرضها.",

  // Messages (complete)
  "messages.title": "الرسائل",
  "messages.empty": "لا توجد رسائل.",
  "messages.reply": "رد",
  "messages.send": "إرسال",
  "messages.placeholder": "اكتبوا رسالتكم…",
  "messages.fromSchool": "من المدرسة",
  "messages.convocation": "استدعاء",

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
  "common.error.unknown": "يرجى إعادة المحاولة. إذا استمرت المشكلة، اتصلوا بالإدارة.",
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
};

const en: Dict = {
  "app.name": "El-Imtiyaz",
  "app.tagline": "Parent & Student Portal",
  "app.loading": "Loading…",

  "auth.signin.title": "Welcome to the El-Imtiyaz Portal",
  "auth.signin.subtitle": "Sign in with your Google account to access your space.",
  "auth.signin.google": "Sign in with Google",
  "auth.signin.secure": "Secure sign-in via Supabase Auth",
  "auth.signin.help": "Need help? Contact your school's administration.",
  "auth.callback.processing": "Authenticating…",
  "auth.callback.redirecting": "Redirecting…",
  "auth.signout": "Sign out",
  "auth.signout.confirm": "Do you really want to sign out?",

  "activation.pending.title": "Your account has not yet been activated",
  "activation.pending.body":
    "Your account was created successfully, but it is pending activation by the school administration. " +
    "Once activated, you will automatically have access to your information and your children's.",
  "activation.pending.contact": "Please contact your school's administration to finalize activation.",
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
  "dashboard.empty.noAnnouncements": "No announcements at this time.",

  // Student (complete)
  "student.select": "Select a child",
  "student.class": "Class",
  "student.level": "Level",
  "student.enrollmentStatus": "Enrollment status",
  "student.code": "Student ID",
  "student.attendance": "Attendance",
  "student.grades": "Grades",
  "student.gpa": "GPA",
  "student.term": "Term",
  "student.subject": "Subject",
  "student.coefficient": "Coefficient",
  "student.score": "Score",
  "student.average": "Average",
  "student.rank": "Rank",
  "student.appreciation": "Appreciation",
  "student.bulletin": "Report card",
  "student.bulletin.download": "Download report card (PDF)",

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
  "finance.balance.credit": "Account credit",
  "finance.balance.settled": "Account settled",
  "finance.installments": "Installments (Tranches)",
  "finance.payments": "Payment history",
  "finance.invoices": "Invoices",
  "finance.receipts": "Receipts",
  "finance.installment.tranche": "Installment",
  "finance.installment.amount": "Amount",
  "finance.installment.due": "Due date",
  "finance.installment.paid": "Paid",
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
  "finance.empty.noPayments": "No payments recorded yet.",
  "finance.empty.noInstallments": "No installments to display.",

  // Messages (complete)
  "messages.title": "Messages",
  "messages.empty": "No messages.",
  "messages.reply": "Reply",
  "messages.send": "Send",
  "messages.placeholder": "Write your message…",
  "messages.fromSchool": "From school",
  "messages.convocation": "Summons",

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
  "common.error.unknown": "Please try again. If the problem persists, contact the administration.",
  "common.empty.title": "Nothing to display",
  "common.tryAgain": "Try again",
  "common.syncing": "Syncing…",
  "common.updated": "Updated",
  "common.justNow": "Just now",
};

export const dictionaries: Record<Locale, Dict> = { fr, ar, en };

/** Translate a key. Falls back to French, then to the key itself. */
export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  let s = dictionaries[locale]?.[key] ?? dictionaries.fr[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

export const isRtl = (locale: Locale): boolean => locale === "ar";
