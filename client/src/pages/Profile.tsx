import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Check, AlertCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { RetroButton } from "@/components/ui/RetroButton";
import { usePlayerStore, COUNTRIES, COUNTRY_FLAGS } from "@/lib/playerStore";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { username, firstName, lastName, country, setProfile, isProfileComplete, getDisplayName, getCountryFlag } = usePlayerStore();
  
  const [formData, setFormData] = useState({
    username: username,
    firstName: firstName,
    lastName: lastName,
    country: country,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    setFormData({ username, firstName, lastName, country });
  }, [username, firstName, lastName, country]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = "Username can only contain letters, numbers, and underscores";
    }
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      setProfile({
        username: formData.username.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        country: formData.country,
      });
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
    }
  };

  const hasChanges = 
    formData.username !== username ||
    formData.firstName !== firstName ||
    formData.lastName !== lastName ||
    formData.country !== country;

  const profileComplete = isProfileComplete();
  const displayName = getDisplayName();
  const flag = getCountryFlag();

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            Profile
          </h1>
          {profileComplete && (
            <p className="text-lg text-muted-foreground">
              {displayName} {flag}
            </p>
          )}
        </motion.div>

        {!profileComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-white font-medium">Profile Incomplete</p>
              <p className="text-xs text-muted-foreground">
                You need to set your username and first name to play online duels.
              </p>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6 space-y-5"
        >
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Username <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg bg-background border text-white focus:outline-none transition-colors ${
                errors.username ? 'border-destructive focus:border-destructive' : 'border-border focus:border-primary'
              }`}
              placeholder="e.g., ChessMaster42"
              data-testid="input-username"
            />
            {errors.username && (
              <p className="text-xs text-destructive mt-1">{errors.username}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              First Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg bg-background border text-white focus:outline-none transition-colors ${
                errors.firstName ? 'border-destructive focus:border-destructive' : 'border-border focus:border-primary'
              }`}
              placeholder="e.g., Ayush"
              data-testid="input-first-name"
            />
            {errors.firstName && (
              <p className="text-xs text-destructive mt-1">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Last Name <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-background border border-border text-white focus:border-primary focus:outline-none transition-colors"
              placeholder="e.g., Dev"
              data-testid="input-last-name"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Country <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <select
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-background border border-border text-white focus:border-primary focus:outline-none transition-colors appearance-none cursor-pointer"
              data-testid="select-country"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code ? `${COUNTRY_FLAGS[c.code]} ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>

          <RetroButton
            onClick={handleSave}
            className="w-full"
            disabled={!hasChanges}
            data-testid="button-save-profile"
          >
            <Check className="w-4 h-4 mr-2" />
            Save Profile
          </RetroButton>
        </motion.div>

        {profileComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-6 bg-card border border-border rounded-xl p-4"
          >
            <p className="text-sm text-muted-foreground mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-white font-medium">{displayName} {flag}</p>
                <p className="text-xs text-muted-foreground">@{username}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
