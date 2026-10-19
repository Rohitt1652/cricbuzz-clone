<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CricbuzzScorecard extends Model
{
    protected $fillable = [
        'match_id',
        'status',
        'is_match_complete',
        'scorecard_data',
    ];

    protected $casts = [
        'scorecard_data' => 'array',
        'is_match_complete' => 'boolean',
    ];

    public function matchInfo()
    {
        return $this->belongsTo(CricbuzzMatch::class, 'match_id', 'match_id');
    }
}
