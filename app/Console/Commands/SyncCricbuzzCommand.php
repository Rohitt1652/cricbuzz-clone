<?php

namespace App\Console\Commands;

use App\Services\CricbuzzApiService;
use Illuminate\Console\Command;

class SyncCricbuzzCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'cricbuzz:sync {--match= : Optional match ID to sync scorecard for}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fetch upcoming matches and scorecards from Cricbuzz RapidAPI and sync to database';

    /**
     * Execute the console command.
     */
    public function handle(CricbuzzApiService $service)
    {
        $this->info('Starting Cricbuzz RapidAPI Synchronization...');

        $matchId = $this->option('match');
        if ($matchId) {
            $this->info("Fetching scorecard for match ID: {$matchId}...");
            $scorecardData = $service->fetchScorecardFromApi((int) $matchId);
            if (!empty($scorecardData)) {
                $service->syncScorecardData((int) $matchId, $scorecardData);
                $this->info("Match {$matchId} scorecard synced successfully!");
            } else {
                $this->error("Failed to fetch scorecard for match {$matchId}");
            }
            return 0;
        }

        $result = $service->syncUpcomingMatches();
        $this->info($result['message']);

        return 0;
    }
}
