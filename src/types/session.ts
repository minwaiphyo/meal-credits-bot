export type PendingManualEntry = {
  month: number;
  year: number;
  screenshotFileId: string;
  rawOcrText: string;
};

export type BotSession = {
  awaitingManualBalance: PendingManualEntry | null;
};
