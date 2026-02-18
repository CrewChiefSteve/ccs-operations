import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-lg font-bold text-text-primary">CCS Operations</h1>
          <p className="text-sm text-text-secondary">
            Internal operations platform
          </p>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
