export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'HSE Enterprise Management Platform API',
    version: '2.5.0',
    description: 'سامانه یکپارچه و جامع مدیریت بهداشت، ایمنی و محیط زیست (HSE) سازمانی با موتور گردش کار عمومی و امضای دیجیتال',
    contact: {
      name: 'HSE Engineering Team',
      email: 'hse-dev@enterprise.internal',
    },
  },
  servers: [
    { url: '/api/v1', description: 'API v1 (Enterprise Modular Architecture)' },
    { url: '/api', description: 'Legacy Compatibility Root' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          meta: { type: 'object' },
          serverTime: { type: 'string', format: 'date-time' },
        },
      },
      WorkflowInstance: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          workflowKey: { type: 'string' },
          entityType: { type: 'string' },
          entityId: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'RETURNED', 'SIGNED', 'CANCELLED'] },
          currentStepOrder: { type: 'integer' },
          isLocked: { type: 'boolean' },
          version: { type: 'integer' },
        },
      },
      WorkPermit: {
        type: 'object',
        properties: {
          permitNumber: { type: 'string', example: 'PTW-140409-0012' },
          title: { type: 'string' },
          permitType: { type: 'string' },
          location: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          status: { type: 'string' },
        },
      },
      Incident: {
        type: 'object',
        properties: {
          incidentNumber: { type: 'string', example: 'INC-140409-0005' },
          title: { type: 'string' },
          incidentType: { type: 'string' },
          severity: { type: 'string' },
          incidentDate: { type: 'string', format: 'date-time' },
          location: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'بررسی سلامت سرور و منابع سیستم',
        tags: ['Monitoring'],
        responses: { 200: { description: 'Server Health Status' } },
      },
    },
    '/health/db': {
      get: {
        summary: 'بررسی سلامت اتصال به پایگاه داده مرکزی',
        tags: ['Monitoring'],
        responses: { 200: { description: 'DB Health' } },
      },
    },
    '/health/services': {
      get: {
        summary: 'بررسی سلامت تمام ماژول‌های فعال سامانه',
        tags: ['Monitoring'],
        responses: { 200: { description: 'Subsystem Health' } },
      },
    },
    '/workflows/instances': {
      get: {
        summary: 'دریافت فهرست تمام گردش‌کارهای فعال',
        tags: ['Workflow Engine'],
        responses: { 200: { description: 'Workflow Instances List' } },
      },
      post: {
        summary: 'ایجاد گردش کار جدید برای هر سند یا فرم در سامانه',
        tags: ['Workflow Engine'],
        responses: { 201: { description: 'Workflow Instance Created' } },
      },
    },
    '/workflows/instances/{id}/action': {
      post: {
        summary: 'انجام عملیات روی گردش کار (تأیید، رد، امضا، عودت، ارجاع مجدد)',
        tags: ['Workflow Engine'],
        responses: { 200: { description: 'Action executed successfully' } },
      },
    },
    '/workflows/instances/{id}/a4-verification': {
      get: {
        summary: 'دریافت تاییدیه و گواهی امضای دیجیتال مناسب چاپ A4',
        tags: ['Workflow Engine'],
        responses: { 200: { description: 'A4 Verification Sheet' } },
      },
    },
    '/ptw': {
      get: {
        summary: 'دریافت فهرست تمام پروانه‌های کار',
        tags: ['PTW (Work Permits)'],
        responses: { 200: { description: 'Work Permits' } },
      },
      post: {
        summary: 'ثبت پروانه کار جدید با بررسی هوشمند تلاقی و گردش کار',
        tags: ['PTW (Work Permits)'],
        responses: { 201: { description: 'Permit created' } },
      },
    },
    '/ptw/check-clashes': {
      post: {
        summary: 'بررسی تلاقی زمانی و مکانی پروانه‌های کار (Clash Detection)',
        tags: ['PTW (Work Permits)'],
        responses: { 200: { description: 'Clashes report' } },
      },
    },
    '/incidents': {
      get: {
        summary: 'دریافت فهرست حوادث و شبه‌حوادث',
        tags: ['Incidents & CAPA'],
        responses: { 200: { description: 'Incidents list' } },
      },
      post: {
        summary: 'ثبت حادثه جدید و آغاز فرآیند تحقیق و CAPA',
        tags: ['Incidents & CAPA'],
        responses: { 201: { description: 'Incident created' } },
      },
    },
    '/health-exams/exam': {
      post: {
        summary: 'ثبت پرونده معاینه طب کار با ادیومتری و نظر نهایی پزشک',
        tags: ['Occupational Health'],
        responses: { 201: { description: 'Exam saved' } },
      },
    },
    '/files/upload': {
      post: {
        summary: 'بارگذاری امن فایل با تعیین نوع موجودیت و اعتبارسنجی حجم',
        tags: ['File Management'],
        responses: { 201: { description: 'File uploaded' } },
      },
    },
    '/notifications': {
      get: {
        summary: 'دریافت اعلان‌ها و هشدارهای کاربری',
        tags: ['Notifications'],
        responses: { 200: { description: 'Notifications' } },
      },
    },
    '/notifications/stream': {
      get: {
        summary: 'جریان رویدادهای زنده سیستم از طریق Server-Sent Events (SSE)',
        tags: ['Notifications'],
        responses: { 200: { description: 'SSE Stream open' } },
      },
    },
  },
};
