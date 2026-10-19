<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CricbuzzSeries extends Model
{
    protected $table = 'cricbuzz_series';

    protected $fillable = [
        'series_id',
        'name',
        'category',
        'month_group',
        'start_date',
        'end_date',
        'match_count',
        'raw_json',
    ];

    protected $casts = [
        'raw_json' => 'array',
        'start_date' => 'integer',
        'end_date' => 'integer',
        'match_count' => 'integer',
    ];

    public function matches()
    {
        return $this->hasMany(CricbuzzMatch::class, 'series_id', 'series_id');
    }
}
