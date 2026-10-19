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
        Schema::create('cricbuzz_scorecards', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('match_id')->unique();
            $table->string('status')->nullable();
            $table->boolean('is_match_complete')->default(false);
            $table->json('scorecard_data')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cricbuzz_scorecards');
    }
};
