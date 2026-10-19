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
        Schema::create('cricbuzz_series', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('series_id')->unique();
            $table->string('name');
            $table->string('category')->default('International'); // International, League, Domestic, Women
            $table->string('month_group')->nullable(); // e.g. OCTOBER 2026
            $table->bigInteger('start_date')->nullable();
            $table->bigInteger('end_date')->nullable();
            $table->integer('match_count')->default(0);
            $table->json('raw_json')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cricbuzz_series');
    }
};
