$("#r_route_id").change(function() {
  console.log('changed');
  $.getJSON("/i", {"agency_id": $("#r_agency_id").val(), "route_id": $(this).val()}, function(data) {
    console.log('got');
    let stop_select = $("#r_stop_id");
    stop_select.html('<option value="0" selected disabled>Select...</option>');
    $.each(data, function() {
      stop_select.get(0).options.add(new Option(`${this.agency_code} ${this.description} (${this.direction} bound)`, this.id));
    });
    stop_select.prop('disabled', false);
  });
});
$("#r_stop_id").change(function() {
  console.log('changed');
  $.getJSON("/i", {"agency_id": $("#r_agency_id").val(), "route_id": $("#r_route_id").val(), "stop_id": $(this).val()}, function(data) {
    console.log('got');
    let trip_select = $("#r_trip_id");
    trip_select.html('<option value="0" selected disabled>Select...</option>');
    $.each(data, function() {
      trip_select.get(0).options.add(new Option(`${moment(this.scheduled_time, 'HH:mm:ss:SSSS').format('h:mm A')}`, this.id));
    });
    trip_select.prop('disabled', false);
  });
});
$("#r_agency_id").change(function() {
  console.log('changed');
  $.getJSON("/i", {"agency_id": $(this).val(), "get_routes": true}, function(data) {
    console.log('got');
    let route_select = $("#r_route_id");
    route_select.html('<option value="0" selected disabled>Select...</option>');
    $.each(data, function() {
      route_select.get(0).options.add(new Option(`${this.number} ${this.description}`, this.id));
    });
    route_select.prop('disabled', false);
  });
});
$("#ar_agency_id").change(function() {
  console.log('changed');
  $.getJSON("/i", {"agency_id": $(this).val(), "get_routes": true}, function(data) {
    console.log('got');
    let route_select = $("#ar_route_id");
    route_select.html('<option value="0" selected disabled>Select...</option>');
    $.each(data, function() {
      route_select.get(0).options.add(new Option(`${this.number} ${this.description}`, this.id));
    });
    route_select.prop('disabled', false);
  });
});
$("#av_agency_id").change(function() {
  console.log('changed');
  $.getJSON("/i", {"agency_id": $(this).val(), "get_fleets": true}, function(data) {
    console.log('got');
    let fleet_select = $("#av_fleet_id");
    fleet_select.html('<option value="0" selected disabled>Select...</option>');
    $.each(data, function() {
      console.log(this.id);
      fleet_select.get(0).options.add(new Option(`${this.name} (${this.engine}/${this.transmission})`, this.id));
    });
    fleet_select.prop('disabled', false);
  });
});
$("#av_fleet_id").change(function() {
  console.log('changed');
  $.getJSON("/i", {"agency_id": $("#av_agency_id").val(), "fleet_id": $(this).val()}, function(data) {
    console.log('got');
    let vehicle_select = $("#av_vehicle_id");
    vehicle_select.html('<option value="0" selected disabled>Select...</option>');
    $.each(data, function() {
      vehicle_select.get(0).options.add(new Option(`${this.fleet_number} (${this.livery})`, this.id));
    });
    vehicle_select.prop('disabled', false);
  });
});
$(window).bind("pageshow", function() {
   $.each($('form'), function() {
      this.reset();
      $("div.date.date-only").datetimepicker({format: 'MM/DD/YYYY', defaultDate: new Date()});
      $("div.date.month-only").datetimepicker({format: 'MM/YYYY', defaultDate: new Date()});
   });
});
