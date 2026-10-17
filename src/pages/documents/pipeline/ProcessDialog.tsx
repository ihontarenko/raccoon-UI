import { useEffect, useState } from "react";
import type { ProcessingProfile } from "../../../lib/pipeline";
import { EmptyState } from "../../../ui/components";
import { Badge, Button, Dialog } from "../../../ui/primitives";
import { describeSteps, indexesDocuments } from "../documentPipeline";
import { CHOICE, CHOICES, CHOICE_TEXT } from "../documentPageClasses";

interface ProcessDialogProperties {
  open: boolean;
  profiles: ProcessingProfile[];
  versionNumber: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (profile: ProcessingProfile) => void;
}

/** Chooses how the version is processed; every profile says what its run will do before it runs. */
export function ProcessDialog({ open, profiles, versionNumber, submitting, onClose, onSubmit }: ProcessDialogProperties) {
  const usable = profiles.filter((profile) => profile.configuration.enabled !== false);
  const preferred = usable.find(indexesDocuments) ?? usable[0] ?? null;
  const [chosenId, setChosenId] = useState<string | null>(preferred?.id ?? null);

  useEffect(() => {
    if (open) {
      setChosenId(preferred?.id ?? null);
    }
    // The preferred profile is read only at opening, so a reload while open does not move the choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const chosen = usable.find((profile) => profile.id === chosenId) ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Process version ${versionNumber}`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" icon="play" disabled={chosen === null || submitting} onClick={() => chosen !== null && onSubmit(chosen)}>
            {submitting ? "Starting…" : "Start processing"}
          </Button>
        </>
      }
    >
      {usable.length === 0 ? (
        <EmptyState
          title="No processing profile"
          description="A processing profile says how a document is parsed, chunked and indexed. Create one under Profiles first."
        />
      ) : (
        <div className={CHOICES} role="radiogroup" aria-label="Processing profile">
          {usable.map((profile) => (
            <label key={profile.id} className={CHOICE}>
              <input
                type="radio"
                name="processing-profile"
                checked={profile.id === chosenId}
                onChange={() => {
                  setChosenId(profile.id);
                }}
              />
              <span className={CHOICE_TEXT}>
                <span>
                  <strong>{profile.name}</strong> <span className="text-xs text-muted">revision {profile.revision}</span>{" "}
                  {!indexesDocuments(profile) && <Badge tone="warn">Does not index</Badge>}
                </span>
                <span className="text-xs text-secondary">{describeSteps(profile)}</span>
              </span>
            </label>
          ))}
          <p className="text-xs text-muted">
            One background job parses, chunks and writes the index. A run with the same profile and version is never duplicated.
          </p>
        </div>
      )}
    </Dialog>
  );
}
