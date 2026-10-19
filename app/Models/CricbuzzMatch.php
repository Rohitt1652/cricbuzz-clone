<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CricbuzzMatch extends Model
{
    protected $fillable = [
        'match_id',
        'series_id',
        'series_name',
        'match_desc',
        'match_format',
        'match_type',
        'start_date',
        'end_date',
        'state',
        'status',
        'team1_id',
        'team1_name',
        'team1_sname',
        'team1_image_id',
        'team2_id',
        'team2_name',
        'team2_sname',
        'team2_image_id',
        'venue_id',
        'venue_ground',
        'venue_city',
        'venue_timezone',
        'raw_json',
    ];

    protected $casts = [
        'raw_json' => 'array',
        'start_date' => 'integer',
        'end_date' => 'integer',
    ];

    public function scorecard()
    {
        return $this->hasOne(CricbuzzScorecard::class, 'match_id', 'match_id');
    }

    public function series()
    {
        return $this->belongsTo(CricbuzzSeries::class, 'series_id', 'series_id');
    }
}
