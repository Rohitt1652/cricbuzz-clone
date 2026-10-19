<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('cricbuzz_matches', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('match_id')->unique();
            $table->unsignedBigInteger('series_id')->nullable();
            $table->string('series_name')->nullable();
            $table->string('match_desc')->nullable();
            $table->string('match_format')->nullable();
            $table->string('match_type')->nullable(); // International, League, Domestic, Women
            $table->bigInteger('start_date')->nullable();
            $table->bigInteger('end_date')->nullable();
            $table->string('state')->nullable();
            $table->string('status')->nullable();
            
            // Team 1
            $table->unsignedBigInteger('team1_id')->nullable();
            $table->string('team1_name')->nullable();
            $table->string('team1_sname')->nullable();
            $table->unsignedBigInteger('team1_image_id')->nullable();

            // Team 2
            $table->unsignedBigInteger('team2_id')->nullable();
            $table->string('team2_name')->nullable();
            $table->string('team2_sname')->nullable();
            $table->unsignedBigInteger('team2_image_id')->nullable();

            // Venue
            $table->unsignedBigInteger('venue_id')->nullable();
            $table->string('venue_ground')->nullable();
            $table->string('venue_city')->nullable();
            $table->string('venue_timezone')->nullable();

            $table->json('raw_json')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cricbuzz_matches');
    }
};
