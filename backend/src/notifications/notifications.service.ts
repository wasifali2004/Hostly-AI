import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventStatus, RegistrationStatus, ReminderStatus } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';

interface EmailProvider {
  emails: {
    send(input: {
      from: string;
      to: string;
      subject: string;
      html: string;
      attachments?: Array<{ filename: string; content: Buffer }>;
    }): Promise<{
      data: { id: string } | null;
      error: { message: string } | null;
    }>;
  };
}

// Resend publishes ESM declarations. Loading its small CommonJS compatibility export here
// keeps the Nest CommonJS build portable without weakening the rest of the tsconfig.
const ResendClient = (
  require('resend') as { Resend: new (apiKey: string) => EmailProvider }
).Resend;

interface InvitationEmail {
  to: string;
  organizationName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
}

interface ConfirmationEmail {
  registrationId: string;
  to: string;
  attendeeName: string;
  eventTitle: string;
  startsAt: Date;
  timezone: string;
  venue: string;
  code: string;
  calendarUrl: string;
}

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly resend?: EmailProvider;
  private readonly from: string;
  private readonly redisUrl?: string;
  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    if (apiKey) this.resend = new ResendClient(apiKey);
    this.from = config.get('EMAIL_FROM', 'Hostly AI <onboarding@resend.dev>');
    this.redisUrl = config.get<string>('REDIS_URL') || undefined;
  }

  async onModuleInit() {
    if (!this.redisUrl) return;
    try {
      this.connection = new IORedis(this.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        connectTimeout: 5_000,
        retryStrategy: (attempt) => (attempt > 2 ? null : attempt * 250),
      });
      await this.connection.connect();
      this.queue = new Queue('hostly-reminders', { connection: this.connection });
      this.worker = new Worker(
        'hostly-reminders',
        async (job) => this.processReminder(job.data.reminderId as string),
        { connection: this.connection, concurrency: 5 },
      );
      this.worker.on('failed', (job, error) => {
        console.error(`Reminder queue job ${job?.id ?? 'unknown'} failed`, error.message);
      });
    } catch (error) {
      console.warn(
        `Redis unavailable; reminder cron fallback remains active: ${(error as Error).message}`,
      );
      await this.closeQueue();
    }
  }

  async onModuleDestroy() {
    await this.closeQueue();
  }

  async sendOrganizationInvitation(input: InvitationEmail) {
    return this.send({
      to: input.to,
      subject: `You’re invited to ${input.organizationName} on Hostly`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17202a">
          <h1 style="font-size:24px">Join ${this.escape(input.organizationName)}</h1>
          <p>${this.escape(input.inviterName)} invited you to join as ${this.escape(input.role.replace('_', ' ').toLowerCase())}.</p>
          <p><a href="${input.acceptUrl}" style="display:inline-block;background:#17202a;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Accept invitation</a></p>
          <p style="color:#667085;font-size:13px">This invitation expires in 7 days.</p>
        </div>`,
    });
  }

  async sendRegistrationConfirmation(input: ConfirmationEmail) {
    const qr = await QRCode.toBuffer(input.code, { width: 360, margin: 1 });
    return this.send({
      to: input.to,
      subject: `You’re registered: ${input.eventTitle}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17202a">
          <p style="color:#59636e">HOSTLY AI</p>
          <h1 style="font-size:26px">You’re on the list, ${this.escape(input.attendeeName)}.</h1>
          <h2 style="font-size:19px">${this.escape(input.eventTitle)}</h2>
          <p>${input.startsAt.toLocaleString('en-US', { timeZone: input.timezone })} (${this.escape(input.timezone)})</p>
          <p>${this.escape(input.venue)}</p>
          <p>Show the QR code attached to this email when you arrive.</p>
          <p><strong>Manual check-in code:</strong> ${this.escape(input.code)}</p>
          <p><a href="${input.calendarUrl}">Add this event to your calendar</a></p>
        </div>`,
      attachments: [
        {
          filename: `hostly-ticket-${input.registrationId}.png`,
          content: qr,
        },
      ],
    });
  }

  async scheduleRegistrationReminder(
    organizationId: string,
    registrationId: string,
    startsAt: Date,
  ) {
    const scheduledFor = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
    if (scheduledFor <= new Date()) {
      await this.prisma.reminderJob.updateMany({
        where: {
          registrationId,
          status: { in: [ReminderStatus.PENDING, ReminderStatus.FAILED] },
        },
        data: { status: ReminderStatus.CANCELLED },
      });
      return null;
    }

    const reminder = await this.prisma.reminderJob.upsert({
      where: { registrationId },
      create: {
        organizationId,
        registrationId,
        scheduledFor,
        status: ReminderStatus.PENDING,
      },
      update: {
        scheduledFor,
        status: ReminderStatus.PENDING,
        attempts: 0,
        lastError: null,
      },
    });
    if (this.queue) {
      await this.queue.add(
        'event-reminder',
        { reminderId: reminder.id },
        {
          jobId: `${reminder.id}-${scheduledFor.getTime()}`,
          delay: Math.max(0, scheduledFor.getTime() - Date.now()),
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      );
    }
    return reminder;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueReminders() {
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
    await this.prisma.$transaction([
      this.prisma.reminderJob.updateMany({
        where: {
          status: ReminderStatus.PROCESSING,
          updatedAt: { lte: staleBefore },
          attempts: { lt: 3 },
        },
        data: { status: ReminderStatus.PENDING },
      }),
      this.prisma.reminderJob.updateMany({
        where: {
          status: ReminderStatus.PROCESSING,
          updatedAt: { lte: staleBefore },
          attempts: { gte: 3 },
        },
        data: {
          status: ReminderStatus.FAILED,
          lastError: 'Reminder worker stopped before completing delivery',
        },
      }),
    ]);
    const due = await this.prisma.reminderJob.findMany({
      where: { status: ReminderStatus.PENDING, scheduledFor: { lte: new Date() } },
      orderBy: { scheduledFor: 'asc' },
      take: 50,
      select: { id: true },
    });
    await Promise.allSettled(due.map(({ id }) => this.processReminder(id)));
  }

  private async processReminder(reminderId: string) {
    const claimed = await this.prisma.reminderJob.updateMany({
      where: {
        id: reminderId,
        status: ReminderStatus.PENDING,
        attempts: { lt: 3 },
        scheduledFor: { lte: new Date() },
      },
      data: { status: ReminderStatus.PROCESSING, attempts: { increment: 1 } },
    });
    if (!claimed.count) return;

    const reminder = await this.prisma.reminderJob.findUnique({
      where: { id: reminderId },
      include: {
        registration: {
          include: { event: true },
        },
      },
    });
    if (!reminder) return;
    const { registration } = reminder;
    if (
      registration.status !== RegistrationStatus.CONFIRMED ||
      registration.event.status !== EventStatus.PUBLISHED
    ) {
      await this.prisma.reminderJob.update({
        where: { id: reminderId },
        data: { status: ReminderStatus.CANCELLED },
      });
      return;
    }

    try {
      const eventUrl = `${this.config.get('FRONTEND_URL', 'http://localhost:3100').split(',')[0]}/events/${registration.event.slug}`;
      const result = await this.send({
        to: registration.attendeeEmail,
        subject: `Tomorrow: ${registration.event.title}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17202a">
            <p>Hi ${this.escape(registration.attendeeName)},</p>
            <h1 style="font-size:24px">${this.escape(registration.event.title)} is coming up.</h1>
            <p>Your event starts in about 24 hours. Your check-in code is <strong>${this.escape(registration.qrCode)}</strong>.</p>
            <p><a href="${eventUrl}">View event details</a></p>
          </div>`,
      });
      await this.prisma.reminderJob.update({
        where: { id: reminderId },
        data: {
          status: ReminderStatus.SENT,
          sentAt: new Date(),
          providerMessageId: result.id,
          lastError: null,
        },
      });
    } catch (error) {
      const retryable = reminder.attempts < 3;
      await this.prisma.reminderJob.update({
        where: { id: reminderId },
        data: {
          status: retryable ? ReminderStatus.PENDING : ReminderStatus.FAILED,
          lastError: (error as Error).message.slice(0, 1000),
        },
      });
      throw error;
    }
  }

  private async send(input: {
    to: string;
    subject: string;
    html: string;
    attachments?: Array<{ filename: string; content: Buffer }>;
  }): Promise<{ id: string }> {
    if (!this.resend) {
      if (this.config.get('NODE_ENV', 'development') !== 'test') {
        console.log(`[email:dev] ${input.subject} -> ${input.to}`);
      }
      return { id: 'development-noop' };
    }
    const response = await this.resend.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    });
    if (response.error) throw new Error(response.error.message);
    return { id: response.data?.id ?? 'unknown' };
  }

  private async closeQueue() {
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
    await this.connection?.quit().catch(() => undefined);
    this.worker = undefined;
    this.queue = undefined;
    this.connection = undefined;
  }

  private escape(value: string) {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[
          character
        ]!,
    );
  }
}
