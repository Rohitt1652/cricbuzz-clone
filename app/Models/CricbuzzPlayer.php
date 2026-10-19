<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CricbuzzPlayer extends Model
{
    protected $fillable = [
        'player_id',
        'name',
        'team_name',
        'role',
        'stats_data',
    ];

    protected $casts = [
        'stats_data' => 'array',
    ];
}
