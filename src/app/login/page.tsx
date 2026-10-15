import { loginAction } from "@/server/actions";
import { LoginPanel } from "./login-panel";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-4xl">
        <header className="mb-10 max-w-xl">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
            St. Martha&rsquo;s Clinic
          </p>
          <h1 className="font-serif text-5xl leading-[1.1] tracking-[-0.03em]">
            Hospital Appointment System
          </h1>
          <p className="mt-4 text-mute">
            Appointments, prescriptions, billing and reports — backed by MySQL 8
            with triggers, stored procedures and ACID slot booking.
          </p>
        </header>
        <LoginPanel login={loginAction} />
        <p className="mt-8 font-mono text-[11px] text-mute">
          Demo logins — admin / reception / dr.ananya · password123
        </p>
      </div>
    </div>
  );
}
